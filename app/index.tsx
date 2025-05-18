// app/index.tsx
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable, StyleSheet,
  Text, TextInput,
  View
} from 'react-native';
import { query } from '../src/database/db';

type MedItem = {
  package_uuid: string;
  name: string;
  description: string | null;
};

export default function MedListScreen() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'az' | 'za'>('az');
  const [data, setData] = useState<MedItem[] | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const order = sort === 'az' ? 'ASC' : 'DESC';
    const rows = await query<MedItem>(
      `SELECT m.uuid        AS package_uuid,
              mm.name       AS name,
              mm.description
         FROM meds m
         JOIN meds_metadata mm ON mm.uuid = m.metadata_uuid
        ORDER BY mm.name ${order};`
    );
    setData(rows);
  }, [sort]);

  useEffect(() => {
    load();
  }, [load]);

  // filtr lokalny po wpisanej frazie
  const filtered = data?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ------  UI  ------ */
  if (data === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const EmptyState = () => (
    <View style={styles.center}>
      <Pressable style={styles.bigBtn} onPress={() => router.push('/add')}>
        <Text style={styles.bigBtnTxt}>Dodaj lek</Text>
      </Pressable>
      <Pressable style={styles.bigBtn} onPress={() => {/* import CSV */}}>
        <Text style={styles.bigBtnTxt}>Importuj dane</Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: MedItem }) => (
    <Pressable
      style={styles.card}
      onPress={() => {/* router.push(`/med/${item.package_uuid}`)  (później) */}}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      {item.description && (
        <Text style={styles.cardDesc}>{item.description}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Search + sort */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.search}
          placeholder="Wyszukiwana fraza"
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        <Picker
          selectedValue={sort}
          onValueChange={v => setSort(v)}
          style={styles.picker}
          dropdownIconColor="white"
        >
          <Picker.Item label="Od A do Z" value="az" />
          <Picker.Item label="Od Z do A" value="za" />
        </Picker>
        <Pressable style={styles.filterBtn} onPress={() => {/* modal tagów */}}>
          <Text style={{ color: 'white' }}>Filtrowanie</Text>
        </Pressable>
      </View>

      {filtered?.length ? (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={it => it.package_uuid}
          contentContainerStyle={{ padding: 12 }}
        />
      ) : (
        <EmptyState />
      )}
    </View>
  );
}

/* ------  Styl  ------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  topBar: { padding: 12 },
  search: {
    backgroundColor: '#2a2a2a',
    borderRadius: 24,
    paddingHorizontal: 16,
    color: 'white',
    marginBottom: 8,
    height: 40,
  },
  picker: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    borderRadius: 8,
    marginBottom: 8,
    height: 40,
  },
  filterBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    flex: 1, alignItems: 'center', justifyContent: 'center',
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
