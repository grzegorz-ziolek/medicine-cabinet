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

import { COLORS } from '../src/constants/theme';
import { query } from '../src/database/db';

// Med Type
type MedItem = {
  package_uuid: string;
  name: string;
  description: string | null;
  qty: number;
  exp: string | null;
};

export default function MedListScreen() {
  // Local state
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'az' | 'za' | 'exp' | 'expd'>('az');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedItem[] | null>(null);

  const router = useRouter();

  // SQL
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

  // Render helpers
  const EmptyState = () => (
    <View style={styles.center}>
      <Pressable style={styles.bigBtn} onPress={() => router.push('/add')}>
        <Text style={styles.bigBtnTxt}>Dodaj lek</Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: MedItem }) => (
    <Pressable 
      style={styles.card}
      onPress={() => router.push({ pathname: '/add', params: { editPackageId: item.package_uuid } })}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      {item.description && (
        <Text style={styles.cardDesc}>{item.description}</Text>
      )}

      {/* TODO ui vis */}
      <Text style={styles.cardDesc}>
        Pozostało: {item.qty} sztuk&nbsp;ważnych&nbsp;do&nbsp;
        {item.exp ?? '—'}
      </Text>
    </Pressable>
  );

  /*  UI  */
  if (data === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/*  Header */}
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.TEXT_MUTED} style={{ marginHorizontal: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Wyszukiwana fraza"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.iconsContainer}>
            <Pressable onPress={() => setOpen(!open)} style={styles.iconButton}>
              <Ionicons name="swap-vertical" size={18} color={COLORS.TEXT_MUTED} />
            </Pressable>
            <Pressable onPress={() => {}} style={styles.iconButton}>
              <Ionicons name="filter" size={18} color={COLORS.TEXT_MUTED} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Sort Dropdown */}
      {open && (
        <View style={styles.sortDropdown}>
          {[
            { label: 'Od A do Z', value: 'az' },
            { label: 'Od Z do A', value: 'za' },
            { label: 'Data – najbliższa', value: 'exp' },
            { label: 'Data – najdalsza', value: 'expd' },
          ].map(item => (
            <Pressable
              key={item.value}
              onPress={() => {
                setSort(item.value);
                setOpen(false);
              }}
              style={styles.sortItem}
            >
              <Text style={styles.sortItemText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/*  List  */}
      {filtered?.length ? (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(it) => it.package_uuid}
          contentContainerStyle={{ padding: 12 }}
          indicatorStyle="white"
        />
      ) : (
        <EmptyState />
      )}
    </View>
  );
}

/*  Styles  */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG_LIGHT },

  header: {
    backgroundColor: COLORS.BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    height: 110,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.TEXT_PLACEHOLDER_DARK,
    zIndex: 20,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 24,
    height: 48,
    backgroundColor: COLORS.INPUT_DARK,
  },
  searchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    paddingRight: 8,
  },
  iconsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
  },
  iconButton: {
    marginLeft: 16,
  },

  sortDropdown: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: COLORS.INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    zIndex: 30,
  },
  sortItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.BORDER_LIGHT,
  },
  sortItemText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
  },

  card: {
    backgroundColor: COLORS.INPUT,
    padding: 14,
    borderRadius: 6,
    marginBottom: 12,
  },
  cardTitle: { color: COLORS.WHITE, fontSize: 16, fontWeight: '600' },
  cardDesc: { color: COLORS.TEXT_MUTED, marginTop: 4 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BG_LIGHT,
  },
  bigBtn: {
    borderWidth: 1,
    borderColor: COLORS.WHITE,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginVertical: 10,
  },
  bigBtnTxt: { color: COLORS.WHITE, fontSize: 16 },
});