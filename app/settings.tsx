import React from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';
import { execute, query } from '../src/database/db';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { getDB } from '../src/database/db';

/* --------------- helpers --------------- */
async function wipeDB() {
  await execute('DELETE FROM meds;');
  await execute('DELETE FROM meds_metadata_tags;');
  await execute('DELETE FROM meds_metadata;');
  await execute('DELETE FROM tags;');
}

async function exportToXLS() {
  /* pobierz wszystkie tabelki w JSON */
  const meds       = await query('SELECT * FROM meds');
  const metadata   = await query('SELECT * FROM meds_metadata');
  const tags       = await query('SELECT * FROM tags');
  const metaTags   = await query('SELECT * FROM meds_metadata_tags');

  /* workbook */
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meds),     'meds');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metadata), 'meds_metadata');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tags),     'tags');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaTags), 'meds_metadata_tags');

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.cacheDirectory + `apteczka-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });

  await Sharing.shareAsync(uri).catch(() => {});
}

async function importFromXLS() {
  /* ---------- wybór pliku ---------- */
  const pick = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  });
  if (pick.type !== 'success') return;

  /* ---------- workbook ---------- */
  const b64 = await FileSystem.readAsStringAsync(pick.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const wb = XLSX.read(b64, { type: 'base64' });

  /* minimalna walidacja */
  if (!wb.Sheets.meds || !wb.Sheets.meds_metadata) {
    Alert.alert('Błąd', 'Plik nie zawiera wymaganych arkuszy.');
    return;
  }

  /* ---------- helpery ---------- */
  const db = getDB();

  const sheet = (name: string) =>
    XLSX.utils.sheet_to_json(wb.Sheets[name] || [], { defval: null }) as Record<string, any>[];

  /** zwraca tablicę nazw kolumn istniejących fizycznie w tabeli */
  const tableCols = async (tx: any, tbl: string) =>
    (
      await new Promise<any[]>((resolve) =>
        tx.executeSql(
          `PRAGMA table_info(${tbl})`,
          [],
          (_, r) => resolve(r.rows._array),
        ),
      )
    ).map((c) => c.name as string);

  /** INSERT zgodny co do liczby kolumn (puste null-e uzupełniamy) */
  const insertRows = async (tx: any, tbl: string, rows: any[]) => {
    if (!rows.length) return;
    const cols = await tableCols(tx, tbl);
    const qs   = cols.map(() => '?').join(',');

    for (const r of rows) {
      const values = cols.map((c) => (c in r ? r[c] : null));
      tx.executeSql(
        `INSERT INTO ${tbl} (${cols.join(',')}) VALUES (${qs})`,
        values,
      );
    }
  };

  /* ---------- właściwy import w 1 transakcji ---------- */
  try {
    db.transaction((tx) => {
      /* FK OFF + wipe */
      tx.executeSql('PRAGMA foreign_keys = OFF');
      ['meds', 'meds_metadata_tags', 'meds_metadata', 'tags'].forEach((tbl) =>
        tx.executeSql(`DELETE FROM ${tbl}`),
      );

      /* kolejność: metadata → tags → relacja → meds */
      insertRows(tx, 'meds_metadata',      sheet('meds_metadata'));
      insertRows(tx, 'tags',               sheet('tags'));
      insertRows(tx, 'meds_metadata_tags', sheet('meds_metadata_tags'));
      insertRows(tx, 'meds',               sheet('meds'));

      tx.executeSql('PRAGMA foreign_keys = ON');
    },
    (err) => {
      console.error(err);
      Alert.alert('Błąd', 'Import nie powiódł się – szczegóły w konsoli.');
    },
    () => {
      Alert.alert('Import', 'Dane zostały zaimportowane.');
    });
  } catch (e) {
    console.error(e);
    Alert.alert('Błąd', 'Import nie powiódł się – sprawdź plik.');
  }
}



/* --------------- UI --------------- */
export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.h1}>Ustawienia</Text>
      </View>

      {/* body */}
      <View style={styles.body}>
        <Pressable style={styles.btn} onPress={importFromXLS}>
          <Text style={styles.btnTxt}>Importuj dane</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={exportToXLS}>
          <Text style={styles.btnTxt}>Eksportuj dane</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.danger]}
          onPress={() =>
            Alert.alert('Usunąć wszystkie dane?', '', [
              { text: 'Anuluj', style: 'cancel' },
              { text: 'Usuń', style: 'destructive', onPress: async () => { await wipeDB(); router.replace('/'); } },
            ])
          }
        >
          <Text style={styles.btnTxt}>Usuń dane</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* --------------- styles --------------- */
const COLOR_BG   = '#0e0e0e';
const COLOR_BODY = '#262626';
const COLOR_BORDER = '#fff';

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLOR_BG },

  header: { backgroundColor: COLOR_BG, paddingVertical: 28, alignItems: 'center' },
  h1:     { color: '#fff', fontSize: 24, fontWeight: '600' },

  body:   { flex: 1, backgroundColor: COLOR_BODY, alignItems: 'center', paddingTop: 40, gap: 36 },

  btn: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderRadius: 6,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontSize: 14 },

  danger: {
    borderColor: '#f55',
  },
});
