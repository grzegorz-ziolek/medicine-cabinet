import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addMedicationPackage, addTag, execute, query } from '../src/database/db';

type Row = { uuid: string; name: string };

export default function AddMedScreen() {
  const router = useRouter();
  const { preselect } = useLocalSearchParams<{ preselect?: string }>();

  /* ---------- formularz ---------- */
  const [productQ, setProductQ] = useState('');
  const [products, setProducts] = useState<Row[]>([]);
  const [product,  setProduct]  = useState<Row | null>(null);

  const [expiry, setExpiry] = useState('');
  const [qty,    setQty]    = useState('');

  const [tagQ,   setTagQ]   = useState('');
  const [tagsDb, setTagsDb] = useState<Row[]>([]);
  const [tags,   setTags]   = useState<Row[]>([]);

  /*powrót z addProduct z ?preselect=uuid */
  useEffect(() => {
    if (!preselect || product) return;
    query<Row>(
      `SELECT uuid, name FROM meds_metadata WHERE uuid = ? LIMIT 1`,
      [preselect],
    ).then(r => r[0] && setProduct(r[0]));
  }, [preselect, product]);

  /* auto-reset przy focusie */
  useFocusEffect(
    React.useCallback(() => {
      if (preselect) return;  // to jest zachowaj stan po addProduct

      setProductQ('');   setProducts([]);   setProduct(null);
      setExpiry('');     setQty('');
      setTagQ('');       setTagsDb([]);     setTags([]);
    }, [preselect])
  );

  /* live search: produkty */
  useEffect(() => {
    if (!productQ) return setProducts([]);
    query<Row>(
      `SELECT uuid, name
         FROM meds_metadata
        WHERE name LIKE ? ORDER BY name LIMIT 10`,
      [`%${productQ}%`],
    ).then(setProducts);
  }, [productQ]);

  /*  live search: tagi */
  useEffect(() => {
    if (!tagQ) return setTagsDb([]);
    query<Row>(
      `SELECT uuid, name
         FROM tags
        WHERE name LIKE ? ORDER BY name LIMIT 10`,
      [`%${tagQ}%`],
    ).then(setTagsDb);
  }, [tagQ]);

  /*  zapis  */
  const save = async () => {
    if (!product) return;
    await addMedicationPackage(
      product.uuid,
      qty ? parseInt(qty, 10) : null,
      expiry || null,
    );
    for (const t of tags)
      await execute(
        `INSERT OR IGNORE INTO meds_metadata_tags (metadata_uuid, tag_uuid)
         VALUES (?, ?)`,
        [product.uuid, t.uuid],
      );
    router.replace('/'); // to wraca na listę
  };

  /*  UI  */
  return (
    <SafeAreaView style={styles.safe}>
      {/* nagłówek z wyszukiwarką produktu */}
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#bbb" style={{ marginHorizontal: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Wpisz nazwę leku do dodania"
            placeholderTextColor="#999"
            value={product ? product.name : productQ}
            editable={!product}
            onChangeText={(txt) => { // czyszczenie jeśli pisze
              if (product) setProduct(null);
              setProductQ(txt);
            }}
          />
        </View>

        {/* dropdown produktów */}
        {productQ && !product && (
          <View style={styles.dropdown}>
            {[...products, { uuid: 'new', name: `➕ Dodaj „${productQ}”` }].map(item => (
              <Pressable
                key={item.uuid}
                onPress={() => {
                  if (item.uuid === 'new') router.push('/addProduct' as any);
                  else { setProduct(item); setProductQ(''); }
                }}
              >
                <Text style={styles.ddItem}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* szary korpus */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.label}>Data ważności</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#777"
          value={expiry}
          onChangeText={setExpiry}
        />

        <Text style={styles.label}>Ilość dawek pozostała</Text>
        <TextInput
          style={styles.input}
          placeholder="np. 12"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
        />

        <Text style={styles.label}>Tagi</Text>
        <TextInput
          style={styles.input}
          placeholder="Szukaj lub dodaj tag"
          placeholderTextColor="#777"
          value={tagQ}
          onChangeText={setTagQ}
        />

        {/* dropdown tagów */}
        {tagQ.length > 0 && (
          <View style={styles.dropdown}>
            {[...tagsDb, { uuid: 'new', name: `➕ Dodaj „${tagQ}”` }].map(item => (
              <Pressable
                key={item.uuid}
                onPress={async () => {
                  let tag = item;
                  if (item.uuid === 'new')
                    tag = { uuid: await addTag(tagQ), name: tagQ };
                  if (!tags.find(t => t.uuid === tag.uuid))
                    setTags([...tags, tag]);
                  setTagQ('');
                }}
              >
                <Text style={styles.ddItem}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* wybrane tagi */}
        <View style={styles.tagBox}>
          {tags.map((t) => (
            <Pressable
              key={t.uuid}
              style={styles.tag}
              onPress={() => setTags(tags.filter((x) => x.uuid !== t.uuid))}
            >
              <Text style={styles.tagTxt}>{t.name}  ✕</Text>
            </Pressable>
          ))}
        </View>

        {/* przyciski */}
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.danger]} onPress={() => router.replace('/')}>
            <Text style={styles.white}>Odrzuć</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.outline]} onPress={save}>
            <Text style={styles.white}>Zapisz</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* styles */
const COLOR_BG   = '#0e0e0e';
const COLOR_BODY = '#262626';
const COLOR_BORDER = '#555';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR_BG },

  header: {
    backgroundColor: COLOR_BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    minHeight: 110,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderRadius: 24,
    height: 48,
    backgroundColor: '#131313',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, paddingRight: 8 },

  dropdown: {
    backgroundColor: COLOR_BG,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderRadius: 8,
    marginTop: 8,
  },
  ddItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: '#eee',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    fontSize: 15,
  },

  body: { flex: 1, backgroundColor: COLOR_BODY, paddingHorizontal: 16, paddingTop: 28 },

  label: { color: '#bbb', marginBottom: 6, fontSize: 13 },

  input: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 22,
    fontSize: 15,
  },

  tagBox: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    borderRadius: 8,
    minHeight: 52,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  tag: { backgroundColor: '#444', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tagTxt: { color: '#eee', fontSize: 13 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  danger: { backgroundColor: '#d33' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#aaa' },
  white: { color: '#fff', fontWeight: '600' },
});
