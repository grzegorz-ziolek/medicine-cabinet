import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  View
} from 'react-native';

import { COLORS } from '../src/constants/theme';
import { addMedicationPackage, addTag, execute, query } from '../src/database/db';

type Row = { uuid: string; name: string };

export default function AddMedScreen() {
  const router = useRouter();
  const { preselect, editPackageId } = useLocalSearchParams<{ preselect?: string; editPackageId?: string }>();

  // Add form
  const [productQ, setProductQ] = useState('');
  const [products, setProducts] = useState<Row[]>([]);
  const [product,  setProduct]  = useState<Row | null>(null);

  const [expiry, setExpiry] = useState('');
  const [qty,    setQty]    = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [tagQ,   setTagQ]   = useState('');
  const [tagsDb, setTagsDb] = useState<Row[]>([]);
  const [tags,   setTags]   = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [userCleared, setUserCleared] = useState(false);

  // Return from addProduct with ?preselect=uuid
  useEffect(() => {
    if (!preselect || product || userCleared) return;
    setUserCleared(false);
    query<Row>(
      `SELECT uuid, name FROM meds_metadata WHERE uuid = ? LIMIT 1`,
      [preselect],
    ).then(r => {
      if (r[0]) {
        setProduct(r[0]);
        router.replace('/add');
      }
    });
  }, [preselect, product, userCleared]);

  // Load existing medicine package data for editing
  useEffect(() => {
    if (!editPackageId) return;
    (async () => {
      try {
        let retries = 0;
        while (retries < 10) {
          try {
            await query('SELECT 1');
            break;
          } catch (e) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        // Load medicine package data
        const packageData = await query<{
          metadata_uuid: string;
          quantity: number;
          expiration_date: string;
        }>(
          `SELECT metadata_uuid, quantity, expiration_date FROM meds WHERE uuid = ? LIMIT 1`,
          [editPackageId]
        );
        
        if (packageData[0]) {
          const pkg = packageData[0];
          setQty(pkg.quantity?.toString() || '');
          setExpiry(pkg.expiration_date || '');
          
          // Load product metadata
          const productData = await query<Row>(
            `SELECT uuid, name FROM meds_metadata WHERE uuid = ? LIMIT 1`,
            [pkg.metadata_uuid]
          );
          if (productData[0]) {
            setProduct(productData[0]);
          }
          
          // Load associated package tags
          const packageTags = await query<Row>(
            `SELECT t.uuid, t.name FROM tags t
             JOIN meds_tags mt ON t.uuid = mt.tag_uuid
             WHERE mt.package_uuid = ?`,
            [editPackageId]
          );
          setTags(packageTags);
        }
      } catch (error) {
        console.error('Failed to load medicine package data', error);
      }
    })();
  }, [editPackageId]);

  // Reset
  useFocusEffect(
    React.useCallback(() => {
      if (!preselect && editPackageId) {
        router.replace('/add');
        return;
      }
      
      if (preselect || editPackageId) return;

      setProductQ('');   setProducts([]);   setProduct(null);
      setExpiry('');     setQty('');
      setTagQ('');       setTagsDb([]);     setTags([]);
    }, [preselect, editPackageId, router])
  );

  // Live search of products
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!productQ) return setProducts([]);
      const results = await query<Row>(
        `SELECT uuid, name
           FROM meds_metadata
          WHERE name LIKE ? ORDER BY name LIMIT 10`,
        [`%${productQ}%`],
      );
      setProducts(results);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [productQ]);

  // Live search of tags
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!tagQ) return setTagsDb([]);
      const results = await query<Row>(
        `SELECT uuid, name
           FROM tags
          WHERE name LIKE ? ORDER BY name LIMIT 10`,
        [`%${tagQ}%`],
      );
      setTagsDb(results);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [tagQ]);

  // Inheritence of product tags
  useEffect(() => {
    if (!product || editPackageId || saving) return;
    (async () => {
      const productTags = await query<Row>(
        `SELECT t.uuid, t.name FROM tags t
         JOIN meds_metadata_tags mt ON t.uuid = mt.tag_uuid
         WHERE mt.metadata_uuid = ?`,
        [product.uuid]
      );
      // Add product tags to current package tags
      setTags(prevTags => {
        const newTags = [...prevTags];
        for (const productTag of productTags) {
          if (!newTags.find(t => t.uuid === productTag.uuid)) {
            newTags.push(productTag);
          }
        }
        return newTags;
      });
    })();
  }, [product, editPackageId, saving]);

  // Saving
  const save = async () => {
    if (!product || saving) return;
    setSaving(true);
    
    try {
    
    if (editPackageId) {
      // Update existing medicine package
      await execute(
        `UPDATE meds SET metadata_uuid = ?, quantity = ?, expiration_date = ?, edited_at = ? WHERE uuid = ?`,
        [product.uuid, qty ? parseInt(qty, 10) || null : null, expiry || null, new Date().toISOString(), editPackageId]
      );
      
      // Update tags for the package
      await execute('BEGIN TRANSACTION');
      try {
        await execute(`DELETE FROM meds_tags WHERE package_uuid = ?`, [editPackageId]);
        for (const t of tags) {
          await execute(
            `INSERT OR IGNORE INTO meds_tags (package_uuid, tag_uuid)
             VALUES (?, ?)`,
            [editPackageId, t.uuid]
          );
        }
        await execute('COMMIT');
      } catch (error) {
        await execute('ROLLBACK');
        throw error;
      }
    } else {
      // Create new medicine package
      const packageId = await addMedicationPackage(
        product.uuid,
        qty ? parseInt(qty, 10) || null : null,
        expiry || null,
      );
      // Add tags with transaction
      if (tags.length > 0) {
        await execute('BEGIN TRANSACTION');
        try {
          for (const t of tags)
            await execute(
              `INSERT OR IGNORE INTO meds_tags (package_uuid, tag_uuid)
               VALUES (?, ?)`,
              [packageId, t.uuid],
            );
          await execute('COMMIT');
        } catch (error) {
          await execute('ROLLBACK');
          throw error;
        }
      }
    }
    
    router.replace('/');
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  /*  UI  */
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header and product search */}
      <View style={styles.header}>
        <View style={styles.searchWrap}>
          {!product ? (
            <Ionicons name="search" size={18} color={COLORS.TEXT_MUTED} style={{ marginHorizontal: 8 }} />
          ) : (
            <View style={{ width: 34 }} />
          )}
          <TextInput
            style={styles.searchInput}
            placeholder="Wpisz nazwę leku do dodania"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
            value={product ? product.name : productQ}
            editable={!product}
            onChangeText={(txt) => {
              if (product) setProduct(null);
              setProductQ(txt);
            }}
          />
          {product && (
            <View style={{ flexDirection: 'row', marginHorizontal: 16 }}>
              <Pressable onPress={() => router.push({ pathname: '/addProduct', params: { editId: product.uuid } })}>
                <Ionicons name="pencil" size={18} color={COLORS.TEXT_MUTED} style={{ marginRight: 16 }} />
              </Pressable>
              <Pressable onPress={() => { setUserCleared(true); setProduct(null); setProductQ(''); router.replace('/add'); }}>
                <Ionicons name="close" size={18} color={COLORS.TEXT_MUTED} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Dropdown */}
      {productQ && !product && (
        <View style={styles.productDropdown}>
          <ScrollView 
            style={[styles.scrollableResults, { height: Math.min(products.length * 48, 192) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {products.map(item => (
              <Pressable
                key={item.uuid}
                onPress={() => { setProduct(item); setProductQ(''); }}
              >
                <Text style={styles.ddItem}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push('/addProduct')}>
            <Text style={[styles.ddItem, styles.addNewItem]}>➕ Dodaj „{productQ}"</Text>
          </Pressable>
        </View>
      )}

      {/* Frame */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 40 }}
        indicatorStyle="white"
      >
        <Text style={styles.label}>Data ważności</Text>
        <View style={styles.inputWithIcon}>
          <TextInput
            style={[styles.input, styles.inputWithIconText]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER_DARK}
            value={expiry}
            editable={false}
          />
          <Pressable style={styles.calendarIcon} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.TEXT_MUTED} />
          </Pressable>
        </View>

        <Text style={styles.label}>Ilość dawek pozostała</Text>
        <TextInput
          style={styles.input}
          placeholder="np. 12"
          placeholderTextColor={COLORS.TEXT_PLACEHOLDER_DARK}
          keyboardType="numeric"
          value={qty}
          onChangeText={(text) => setQty(text.replace(/[^0-9]/g, ''))}
        />

        <Text style={styles.label}>Tagi</Text>
        <TextInput
          style={[styles.input, tagQ.length > 0 && { marginBottom: 0 }]}
          placeholder="Szukaj lub dodaj tag"
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

        {/* Buttons */}
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.danger]} onPress={() => {
            router.replace('/');
          }}>
            <Text style={styles.white}>Odrzuć</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.outline]} onPress={save}>
            <Text style={styles.white}>Zapisz</Text>
          </Pressable>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const formatted = selectedDate.toISOString().split('T')[0];
              setExpiry(formatted);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.BG },

  header: {
    backgroundColor: COLORS.BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    minHeight: 110,
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
  searchInput: { flex: 1, color: COLORS.TEXT_PRIMARY, fontSize: 16, paddingRight: 8 },

  productDropdown: {
    position: 'absolute',
    top: 82,
    left: 16,
    right: 16,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    zIndex: 30,
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

  inputWithIcon: {
    position: 'relative',
  },
  inputWithIconText: {
    paddingRight: 40,
    marginBottom: 22,
  },
  calendarIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
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