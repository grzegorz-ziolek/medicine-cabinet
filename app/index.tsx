import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { query } from '../src/database/db';

/* ---------- typ rekordu ---------- */
type MedItem = {
  package_uuid: string;
  name: string;
  description: string | null;
  qty: number;              // ⇦ NEW
  exp: string | null;       // ⇦ NEW
};

export default function MedListScreen() {
  /* ---------- local state ---------- */
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'az' | 'za' | 'exp' | 'expd'>('az');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedItem[] | null>(null);

  const router = useRouter();

  /* ---------- SQL ---------- */
  const load = useCallback(async () => {
    let orderClause = 'mm.name COLLATE NOCASE ASC';
    if (sort === 'za')   orderClause = 'mm.name COLLATE NOCASE DESC';
    if (sort === 'exp')  orderClause = 'm.expiration_date ASC';
    if (sort === 'expd') orderClause = 'm.expiration_date DESC';

    const rows = await query<MedItem>(
      `SELECT m.uuid               AS package_uuid,
              mm.name              AS name,
              mm.description,
              COALESCE(m.quantity,0)   AS qty,     -- ⇦ NEW
              m.expiration_date        AS exp      -- ⇦ NEW
         FROM meds m
         JOIN meds_metadata mm ON mm.uuid = m.metadata_uuid
        ORDER BY ${orderClause};`
    );
    setData(rows);
  }, [sort]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const filtered = data?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ---------- render helpers ---------- */
  const EmptyState = () => (
    <View style={styles.center}>
      <Pressable style={styles.bigBtn} onPress={() => router.push('/add')}>
        <Text style={styles.bigBtnTxt}>Dodaj lek</Text>
      </Pressable>
      <Pressable style={styles.bigBtn}>
        <Text style={styles.bigBtnTxt}>Importuj dane</Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: MedItem }) => (
    <Pressable style={styles.card}>
      <Text style={styles.cardTitle}>{item.name}</Text>
      {item.description && (
        <Text style={styles.cardDesc}>{item.description}</Text>
      )}

      {/* -------- nowy wiersz -------- */}
      <Text style={styles.cardDesc}>
        Pozostało: {item.qty} sztuk&nbsp;ważnych&nbsp;do&nbsp;
        {item.exp ?? '—'}
      </Text>
    </Pressable>
  );

  /* ---------- UI ---------- */
  if (data === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ===== nagłówek ===== */}
      {/* (bez zmian względem poprzedniej wersji) */}
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Wyszukiwana fraza"
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.row}>
          <DropDownPicker
            open={open}
            value={sort}
            setOpen={setOpen}
            setValue={setSort}
            items={[
              { label: 'Od A do Z',         value: 'az' },
              { label: 'Od Z do A',         value: 'za' },
              { label: 'Data – najbliższa', value: 'exp' },
              { label: 'Data – najdalsza',  value: 'expd' },
            ]}
            containerStyle={{ flex: 1 }}
            style={styles.picker}
            dropDownContainerStyle={styles.pickerList}
            textStyle={{ color: 'white' }}
            listItemLabelStyle={{ color: 'white' }}
            placeholder=""
            openDirection="DOWN"
            ArrowDownIconComponent={() => (
              <Ionicons name="chevron-down" size={18} color="white" />
            )}
            ArrowUpIconComponent={() => (
              <Ionicons name="chevron-up" size={18} color="white" />
            )}
          />

          <Pressable style={styles.filterBtn} onPress={() => {}}>
            <Text style={{ color: 'white' }}>Filtrowanie</Text>
          </Pressable>
        </View>
      </View>

      {/* ===== lista / pusty stan ===== */}
      {filtered?.length ? (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(it) => it.package_uuid}
          contentContainerStyle={{ padding: 12 }}
        />
      ) : (
        <EmptyState />
      )}
    </View>
  );
}

/* ---------- style ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },

  header: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    zIndex: 10,
  },

  search: {
    backgroundColor: '#2a2a2a',
    borderRadius: 24,
    paddingHorizontal: 16,
    color: 'white',
    height: 40,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },

  picker: {
    flex: 1,
    height: 40,
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
  },

  pickerList: {
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
  },

  filterBtn: {
    borderWidth: 1,
    borderColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  card: {
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 6,
    marginBottom: 12,
  },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#bbb', marginTop: 4 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  bigBtn: {
    borderWidth: 1,
    borderColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 10,
  },
  bigBtnTxt: { color: 'white', fontSize: 16 },
});
