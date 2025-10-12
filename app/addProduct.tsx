import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../src/constants/theme';
import { addMedicationMetadata, addTag, findMedicineByBarcode, query } from '../src/database/db';
import { logger } from '../src/utils/logger';

type Row = { uuid: string; name: string };

function AddProductScreen() {
  const router = useRouter();

  //  Add Product Form
  const [name, setName]       = useState('');
  const [substance, setSubst] = useState('');
  const [desc, setDesc]       = useState('');

  const [tagQ, setTagQ]   = useState('');
  const [tagsDb, setTagsDb] = useState<Row[]>([]);
  const [tags, setTags]   = useState<Row[]>([]);

  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);



  // Tag search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!tagQ) return setTagsDb([]);
      try {
        const results = await query<Row>(
          `SELECT uuid, name FROM tags
            WHERE name LIKE ? ORDER BY name
            LIMIT 10`,
          [`%${tagQ}%`],
        );
        setTagsDb(results);
      } catch (error) {
        logger.error('Failed to search tags', error);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [tagQ]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setShowScanner(false);
    setIsProcessing(true);
    setShowModal(true);
    
    try {
      const medicine = await findMedicineByBarcode(data);
      if (medicine) {
        setName(medicine.name || '');
        setSubst(medicine.product_name || '');
        setDesc(medicine.description || '');
        setModalMessage('Produkt znaleziony');
      } else {
        setModalMessage('Produktu nie znaleziono');
      }
    } catch (error: any) {
      logger.error('Barcode scanning failed', error);
      if (error.message === 'Multiple matches found') {
        setModalMessage('Błąd wyszukiwania');
      } else {
        setModalMessage('Produktu nie znaleziono');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setShowScanner(true);
    } else {
      Alert.alert('', 'Nie udzielono uprawnień', [{ text: 'OK' }]);
    }
  };

  // Saving
  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Błąd', 'Pole „Nazwa" jest wymagane.');
      return;
    }
    
    const prodId = await addMedicationMetadata(
      name.trim(),
      desc.trim(),
      tags.map(t => t.uuid),
    );
    router.replace({ pathname: '/add', params: { preselect: prodId } });
  };

  const cancel = () => {
    setName('');
    setSubst('');
    setDesc('');
    setTags([]);
    setTagQ('');
    setTagsDb([]);
    router.replace('/add');
  };

  /*  UI  */
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTxt}>Dodawanie{'\n'}nowego produktu</Text>
        <Pressable style={styles.scanButton} onPress={openCamera}>
          <Ionicons name="camera" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
      </View>

      {/* Frame */}
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" indicatorStyle="white">
        <Text style={styles.label}>Nazwa</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Substancja czynna</Text>
        <TextInput style={styles.input} value={substance} onChangeText={setSubst} />

        <Text style={styles.label}>Opis</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          multiline
          value={desc}
          onChangeText={setDesc}
        />

        <Text style={styles.label}>Tagi</Text>
        <TextInput
          style={[styles.input, tagQ.length > 0 && { marginBottom: 0 }]}
          placeholder="Szukaj i otaguj"
          placeholderTextColor={COLORS.TEXT_PLACEHOLDER_DARK}
          value={tagQ}
          onChangeText={setTagQ}
          maxLength={25}
        />

        {/* Dropdown tags */}
        {tagQ.length > 0 && (
          <View style={styles.dropdown}>
            <ScrollView 
              style={[styles.scrollableResults, { height: Math.min(tagsDb.length * 48, 192) }]}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              indicatorStyle="white"
            >
              {tagsDb.map(item => (
                <Pressable
                  key={item.uuid}
                  onPress={async () => {
                    if (!tags.find(t => t.uuid === item.uuid))
                      setTags([...tags, item]);
                    setTagQ('');
                  }}
                >
                  <Text style={styles.ddItem}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {!tagsDb.find(t => t.name.toLowerCase() === tagQ.toLowerCase()) && (
              <Pressable
                onPress={async () => {
                  const tag = { uuid: await addTag(tagQ), name: tagQ };
                  if (!tags.find(t => t.uuid === tag.uuid))
                    setTags([...tags, tag]);
                  setTagQ('');
                }}
              >
                <Text style={[styles.ddItem, styles.addNewItem]}>➕ Dodaj „{tagQ}"</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Chosen tags */}
        <View style={styles.tagBox}>
          {tags.map(t => (
            <Pressable
              key={t.uuid}
              style={styles.tag}
              onPress={() => setTags(tags.filter(x => x.uuid !== t.uuid))}
            >
              <Text style={styles.tagTxt}>{t.name}  ✕</Text>
            </Pressable>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.danger]} onPress={cancel}>
            <Text style={styles.white}>Odrzuć</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.outline]} onPress={save}>
            <Text style={styles.white}>Zapisz</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8'],
            }}
          />
          <View style={styles.scannerOverlay}>
            <Pressable style={styles.closeButton} onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={30} color={COLORS.TEXT_PRIMARY} />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Barcode Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{modalMessage}</Text>
            {!isProcessing && (
              <Pressable style={styles.modalBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.modalBtnText}>OK</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default AddProductScreen;

/*  Styles  */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.BG },

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
  headerTxt: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },

  scanButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
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

  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 10,
  },

  body: { flex: 1, backgroundColor: COLORS.BODY, paddingHorizontal: 16, paddingTop: 28 },

  label: { color: COLORS.TEXT_MUTED, marginBottom: 6, fontSize: 13 },

  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 22,
    fontSize: 15,
  },

  dropdown: {
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    marginBottom: 22,
  },
  scrollableResults: {
    height: 192,
  },
  addNewItem: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_LIGHT,
  },
  ddItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: COLORS.TEXT_SECONDARY,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.BORDER_LIGHT,
    fontSize: 15,
  },

  tagBox: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    minHeight: 52,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  tag: { backgroundColor: COLORS.TAG, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tagTxt: { color: COLORS.TEXT_SECONDARY, fontSize: 13 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  danger: { backgroundColor: COLORS.DANGER },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#aaa' },
  white: { color: COLORS.TEXT_PRIMARY, fontWeight: '600' },
});