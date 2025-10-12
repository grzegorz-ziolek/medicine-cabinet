import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';
import { execute, importMedicineFromCSV, query } from '../src/database/db';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { COLORS } from '../src/constants/theme';
import { logger } from '../src/utils/logger';

// Helpers
async function wipeDB() {
  try {
    // Disable foreign keys
    await execute('PRAGMA foreign_keys = OFF;');
    
    await execute('DELETE FROM meds_tags;');
    await execute('DELETE FROM meds_metadata_tags;');
    await execute('DELETE FROM meds_packaging;');
    await execute('DELETE FROM meds;');
    await execute('DELETE FROM meds_metadata;');
    await execute('DELETE FROM tags;');
    
    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON;');
  } catch (error) {
    console.error('Failed to wipe database:', error);
    throw error;
  }
}

async function exportToXLS(
  onStart: () => void,
  onComplete: () => void,
  onError: (error: string) => void
) {
  try {
    onStart();
    
    /* Get all */
    const meds       = await query('SELECT * FROM meds');
    const metadata   = await query('SELECT * FROM meds_metadata');
    const tags       = await query('SELECT * FROM tags');
    const metaTags   = await query('SELECT * FROM meds_metadata_tags');
    const packaging  = await query('SELECT * FROM meds_packaging');

    /* XLSX */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meds),     'meds');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metadata), 'meds_metadata');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tags),     'tags');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaTags), 'meds_metadata_tags');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(packaging), 'meds_packaging');

    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + `apteczka-${Date.now()}.xlsx`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });

    await Sharing.shareAsync(uri);
    onComplete();
  } catch (error) {
    logger.error('Failed to export data', error);
    onError('Eksport nie powiódł się');
  }
}

async function downloadMedicineDatabase(
  onProgress: (message: string) => void,
  onError: (error: string) => void,
  onComplete: () => void,
  abortSignal: AbortSignal
) {
  try {
    onProgress('Pobieranie...');
    
    // LINK
    const response = await fetch(
      'https://rejestry.ezdrowie.gov.pl/api/rpl/medicinal-products/public-pl-report/get-csv',
      { signal: abortSignal }
    );
    
    if (!response.ok) throw new Error('Błąd pobierania danych');
    
    const csvText = await response.text();
    if (abortSignal.aborted) return;
    
    onProgress('Importowanie...');
    
    const lines = csvText.split('\n');
    const headers = lines[0].split(';').map(h => h.replace(/"/g, ''));
    
    const getIndex = (name: string) => headers.indexOf(name);
    const productIdIdx = getIndex('Identyfikator Produktu Leczniczego');
    const productNameIdx = getIndex('Nazwa Produktu Leczniczego');
    const commonNameIdx = getIndex('Nazwa powszechnie stosowana');
    const typeIdx = getIndex('Rodzaj preparatu');
    const previousNameIdx = getIndex('Nazwa poprzednia produktu');
    const administrationIdx = getIndex('Droga podania - Gatunek - Tkanka - Okres karencji');
    const strengthIdx = getIndex('Moc');
    const formIdx = getIndex('Postać farmaceutyczna');
    const packagingIdx = getIndex('Opakowanie');
    const substanceIdx = getIndex('Substancja czynna');
    const leafletIdx = getIndex('Ulotka');
    const characteristicIdx = getIndex('Charakterystyka');
    const labelLeafletIdx = getIndex('Etykieto-ulotka');
    
    for (let i = 1; i < lines.length; i++) {
      if (abortSignal.aborted) return;
      
      const row = lines[i].split(';').map(cell => cell.replace(/"/g, ''));
      if (row[typeIdx] === 'Ludzki' && row[commonNameIdx]) {
        await importMedicineFromCSV(
          row[productNameIdx] || '',
          row[characteristicIdx] || '',
          row[productIdIdx] || '',
          row[commonNameIdx] || '',
          row[previousNameIdx] || '',
          row[administrationIdx] || '',
          row[strengthIdx] || '',
          row[formIdx] || '',
          row[packagingIdx] || '',
          row[substanceIdx] || '',
          row[leafletIdx] || '',
          row[labelLeafletIdx] || ''
        );
      }
    }
    
    onComplete();
  } catch (error: any) {
    if (!abortSignal.aborted) {
      onError(error.message || 'Nieznany błąd');
    }
  }
}

async function importFromXLS(
  onStart: () => void,
  onSuccess: () => void,
  onError: (error: string) => void
) {
  try {
    onStart();
    
    //  File chosing
    const pick = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
    });
    if (pick.canceled) {
      onError('Anulowano');
      return;
    }

    const b64 = await FileSystem.readAsStringAsync(pick.assets[0].uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const wb = XLSX.read(b64, { type: 'base64' });

    if (!wb.Sheets.meds || !wb.Sheets.meds_metadata) {
      onError('Plik nie zawiera wymaganych arkuszy.');
      return;
    }

    const sheet = (name: string) =>
      XLSX.utils.sheet_to_json(wb.Sheets[name] || [], { defval: null }) as Record<string, any>[];

    const insertRows = async (tbl: string, rows: any[]) => {
      if (!rows.length) return;
      const cols = await query<{name: string}>(`PRAGMA table_info(${tbl})`);
      const colNames = cols.map(c => c.name);
      const qs = colNames.map(() => '?').join(',');

      for (const r of rows) {
        const values = colNames.map(c => (c in r ? r[c] : null));
        await execute(`INSERT OR REPLACE INTO ${tbl} (${colNames.join(',')}) VALUES (${qs})`, values);
      }
    };

    // Delete all
    await execute('PRAGMA foreign_keys = OFF');
    await execute('DELETE FROM meds_tags');
    await execute('DELETE FROM meds');
    await execute('DELETE FROM meds_metadata_tags');
    await execute('DELETE FROM meds_packaging');
    await execute('DELETE FROM meds_metadata');
    await execute('DELETE FROM tags');

    // Import in order
    await insertRows('tags', sheet('tags'));
    await insertRows('meds_metadata', sheet('meds_metadata'));
    await insertRows('meds_metadata_tags', sheet('meds_metadata_tags'));
    await insertRows('meds_packaging', sheet('meds_packaging'));
    await insertRows('meds', sheet('meds'));

    await execute('PRAGMA foreign_keys = ON');
    onSuccess();
  } catch (e) {
    logger.error('Import from XLS failed', e);
    onError('Import nie powiódł się – sprawdź plik.');
  }
}



/* UI */
export default function SettingsScreen() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importComplete, setImportComplete] = useState(false);
  
  const handleDownloadDatabase = () => {
    const controller = new AbortController();
    setAbortController(controller);
    setShowModal(true);
    setIsProcessing(true);
    
    downloadMedicineDatabase(
      (message) => setModalMessage(message),
      (error) => {
        setModalMessage(error.split(' ').slice(0, 20).join(' '));
        setIsProcessing(false);
      },
      () => {
        setModalMessage('Gotowe');
        setIsProcessing(false);
      },
      controller.signal
    );
  };
  
  const handleModalButton = () => {
    if (isProcessing) {
      abortController?.abort();
      setIsProcessing(false);
    }
    setShowModal(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.h1}>Ustawienia</Text>
      </View>

      {/* Frame */}
      <View style={styles.body}>
        <Pressable style={styles.btn} onPress={() => router.push('/editTags')}>
          <Text style={styles.btnTxt}>Edytuj tagi</Text>
        </Pressable>
        
        <Pressable style={styles.btn} onPress={handleDownloadDatabase}>
          <Text style={styles.btnTxt}>Pobierz bazę leków</Text>
        </Pressable>
        
        <Pressable style={styles.btn} onPress={() => importFromXLS(
          () => {
            setImportMessage('Importowanie...');
            setImportComplete(false);
            setShowImportModal(true);
          },
          () => {
            setImportMessage('Zaimportowano');
            setImportComplete(true);
          },
          (error) => {
            setImportMessage(error);
            setImportComplete(true);
          }
        )}>
          <Text style={styles.btnTxt}>Importuj dane</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => exportToXLS(
          () => {
            setModalMessage('Eksportowanie...');
            setIsProcessing(true);
            setShowModal(true);
          },
          () => {
            setShowModal(false);
            setIsProcessing(false);
          },
          (error) => {
            setModalMessage(error);
            setIsProcessing(false);
          }
        )}>
          <Text style={styles.btnTxt}>Eksportuj dane</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.danger]}
          onPress={() =>
            Alert.alert('Usunąć wszystkie dane?', '', [
              { text: 'Anuluj', style: 'cancel' },
              { text: 'Usuń', style: 'destructive', onPress: async () => { 
                try {
                  await wipeDB(); 
                  router.replace('/');
                  setTimeout(() => router.replace('/'), 100);
                } catch (error) {
                  Alert.alert('Błąd', 'Nie udało się usunąć danych: ' + error.message);
                }
              } },
            ])
          }
        >
          <Text style={styles.btnTxt}>Usuń dane</Text>
        </Pressable>
      </View>
      
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{modalMessage}</Text>
            {!isProcessing && (
              <Pressable style={styles.modalBtn} onPress={handleModalButton}>
                <Text style={styles.modalBtnText}>Zakończ</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showImportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{importMessage}</Text>
            {importComplete && (
              <Pressable style={styles.modalBtn} onPress={() => setShowImportModal(false)}>
                <Text style={styles.modalBtnText}>OK</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.BG },

  header: {
    backgroundColor: COLORS.BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    minHeight: 110,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.TEXT_PLACEHOLDER_DARK,
    zIndex: 20,
  },
  h1:     { color: COLORS.TEXT_PRIMARY, fontSize: 24, fontWeight: '600' },

  body:   { flex: 1, backgroundColor: COLORS.BODY, alignItems: 'center', paddingTop: 40, gap: 36 },

  btn: {
    borderWidth: 1,
    borderColor: COLORS.WHITE,
    borderRadius: 6,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  btnTxt: { color: COLORS.TEXT_PRIMARY, fontSize: 14 },

  danger: {
    borderColor: COLORS.DANGER_LIGHT,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.BODY,
    borderRadius: 12,
    padding: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  modalText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalBtn: {
    borderWidth: 1,
    borderColor: COLORS.WHITE,
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalBtnText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
  },
});