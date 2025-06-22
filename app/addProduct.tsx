import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { addMedicationMetadata, addTag, query } from '../src/database/db';

type Row = { uuid: string; name: string };

export default function AddProductScreen() {
  const router = useRouter();

  /* ---------- formularz ---------- */
  const [name, setName]         = useState('');
  const [substance, setSubst]   = useState('');
  const [desc, setDesc]         = useState('');

  const [tagQ, setTagQ]         = useState('');
  const [tagsDb, setTagsDb]     = useState<Row[]>([]);
  const [tags, setTags]         = useState<Row[]>([]);

  /* ---------- live-search tag ---------- */
  useEffect(() => {
    if (!tagQ) return setTagsDb([]);
    query<Row>(
      `SELECT uuid, name FROM tags WHERE name LIKE ? ORDER BY name LIMIT 10`,
      [`%${tagQ}%`]
    ).then(setTagsDb);
  }, [tagQ]);

  /* ---------- zapis ---------- */
  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Błąd', 'Pole „Nazwa” jest wymagane.');
      return;
    }
    const newProdId = await addMedicationMetadata(
      name, desc, tags.map(t => t.uuid)
    );
    // wracamy na /add z nowo dodanym produktem już wybranym
    router.replace({ pathname: '/add', params: { preselect: newProdId } });
  };

  /* ---------- anuluj ---------- */
  const cancel = () => router.replace('/add');

  /* ------------------- UI ------------------- */
  return (
    <SafeAreaView style={styles.safe}>
      {/* czarny nagłówek */}
      <View style={styles.header}>
        <Text style={styles.headerTxt}>Dodawanie{'\n'}nowego produktu</Text>
      </View>

      {/* szary korpus */}
      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nazwa</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Substancja czynna</Text>
        <TextInput
          style={styles.input}
          value={substance}
          onChangeText={setSubst}
        />

        <Text style={styles.label}>Opis</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          multiline
          value={desc}
          onChangeText={setDesc}
        />

        <Text style={styles.label}>Tagi</Text>
        <TextInput
          style={styles.input}
          placeholder="Szukaj i otaguj"
          placeholderTextColor="#777"
          value={tagQ}
          onChangeText={setTagQ}
        />

        {tagQ.length > 0 && (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={[...tagsDb, { uuid: 'new', name: `➕ Dodaj „${tagQ}”` }]}
            keyExtractor={i => i.uuid}
            style={styles.dropdown}
            renderItem={({ item }) => (
              <Pressable
                onPress={async () => {
                  let tag = item;
                  if (item.uuid === 'new') tag = { uuid: await addTag(tagQ), name: tagQ };
                  if (!tags.find(t => t.uuid === tag.uuid))
                    setTags([...tags, tag]);
                  setTagQ('');
                }}
              >
                <Text style={styles.ddItem}>{item.name}</Text>
              </Pressable>
            )}
          />
        )}

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

        {/* przyciski */}
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.danger]} onPress={cancel}>
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

/* ---------- styles ---------- */
const COLOR_BG   = '#0e0e0e';
const COLOR_BODY = '#262626';
const COLOR_BORDER = '#555';

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLOR_BG },
  header: { backgroundColor: COLOR_BG, paddingTop: 30, paddingBottom: 26,
            alignItems: 'center', justifyContent: 'flex-end' },
  headerTxt:{ color: '#fff', fontSize: 20, fontWeight: '600', textAlign: 'center', lineHeight: 24 },

  body:   { flex:1, backgroundColor: COLOR_BODY, paddingHorizontal:16, paddingTop:28 },

  label:  { color:'#bbb', marginBottom:6, fontSize:13 },

  input:  {
    borderWidth:1, borderColor:COLOR_BORDER, borderRadius:8,
    padding:12, color:'#fff', marginBottom:22, fontSize:15,
  },

  dropdown:{
    backgroundColor:COLOR_BG, maxHeight:180,
    borderWidth:1, borderColor:COLOR_BORDER, borderRadius:8, marginTop:8,
  },
  ddItem:{ paddingVertical:12, paddingHorizontal:12, color:'#eee',
           borderBottomWidth:0.5, borderBottomColor:'#333', fontSize:15 },

  tagBox:{
    borderWidth:1, borderColor:COLOR_BORDER, borderRadius:8,
    minHeight:52, padding:8, flexDirection:'row', flexWrap:'wrap',
    gap:8, marginBottom:32,
  },
  tag:{ backgroundColor:'#444', borderRadius:14, paddingHorizontal:12, paddingVertical:6 },
  tagTxt:{ color:'#eee', fontSize:13 },

  row:{ flexDirection:'row', justifyContent:'space-between', marginTop:8 },
  btn:{ flex:1, padding:16, borderRadius:10, alignItems:'center', marginHorizontal:4 },
  danger:{ backgroundColor:'#d33' },
  outline:{ backgroundColor:'transparent', borderWidth:1, borderColor:'#aaa' },
  white:{ color:'#fff', fontWeight:'600' },
});
