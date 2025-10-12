import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
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

type DateFilter = 'all' | 'expired' | 'expiring30' | 'longer30' | 'custom';

type FilterState = {
  dateFilter: DateFilter;
  selectedTags: string[];
  customDateFrom: string;
  customDateTo: string;
};

type Tag = {
  uuid: string;
  name: string;
};

export default function MedListScreen() {
  // Local state
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'az' | 'za' | 'exp' | 'expd'>('az');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MedItem[] | null>(null);
  
  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [activeFilters, setActiveFilters] = useState<FilterState>({ 
    dateFilter: 'all', 
    selectedTags: [], 
    customDateFrom: today, 
    customDateTo: today 
  });
  const [tempFilters, setTempFilters] = useState<FilterState>({ 
    dateFilter: 'all', 
    selectedTags: [], 
    customDateFrom: today, 
    customDateTo: today 
  });
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to'>('from');

  const router = useRouter();

  // SQL
  const load = useCallback(async () => {
    let orderClause = 'mm.name COLLATE NOCASE ASC';
    if (sort === 'za')   orderClause = 'mm.name COLLATE NOCASE DESC';
    if (sort === 'exp')  orderClause = 'm.expiration_date ASC';
    if (sort === 'expd') orderClause = 'm.expiration_date DESC';

    let whereClause = '';
    const params: any[] = [];
    
    // Date filters
    const todayStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (activeFilters.dateFilter === 'expired') {
      whereClause = 'WHERE m.expiration_date < ?';
      params.push(todayStr);
    } else if (activeFilters.dateFilter === 'expiring30') {
      whereClause = 'WHERE m.expiration_date >= ? AND m.expiration_date <= ?';
      params.push(todayStr, in30Days);
    } else if (activeFilters.dateFilter === 'longer30') {
      whereClause = 'WHERE m.expiration_date > ?';
      params.push(in30Days);
    } else if (activeFilters.dateFilter === 'custom') {
      whereClause = 'WHERE m.expiration_date >= ? AND m.expiration_date <= ?';
      params.push(activeFilters.customDateFrom, activeFilters.customDateTo);
    }
    
    // Tag filters (AND logic)
    if (activeFilters.selectedTags.length > 0) {
      const tagConditions = activeFilters.selectedTags.map(() => `(
        m.uuid IN (
          SELECT mt.package_uuid FROM meds_tags mt WHERE mt.tag_uuid = ?
        ) OR
        mm.uuid IN (
          SELECT mmt.metadata_uuid FROM meds_metadata_tags mmt WHERE mmt.tag_uuid = ?
        )
      )`).join(' AND ');
      
      if (whereClause) {
        whereClause += ` AND (${tagConditions})`;
      } else {
        whereClause = `WHERE (${tagConditions})`;
      }
      
      // Add each tag twice (for package tags and metadata tags)
      activeFilters.selectedTags.forEach(tag => {
        params.push(tag, tag);
      });
    }

    const rows = await query<MedItem>(
      `SELECT m.uuid               AS package_uuid,
              mm.name              AS name,
              mm.description,
              COALESCE(m.quantity,0)   AS qty,
              m.expiration_date        AS exp
         FROM meds m
         JOIN meds_metadata mm ON mm.uuid = m.metadata_uuid
        ${whereClause}
        ORDER BY ${orderClause};`,
      params
    );
    setData(rows);
  }, [sort, activeFilters]);
  
  // Load all tags
  const loadTags = useCallback(async () => {
    const tags = await query<Tag>(
      `SELECT DISTINCT uuid, name FROM tags ORDER BY name COLLATE NOCASE ASC`
    );
    setAllTags(tags);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTags(); }, [loadTags]);
  useFocusEffect(React.useCallback(() => { load(); loadTags(); }, [load, loadTags]));

  const filtered = data?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  
  // Filter handlers
  const openFilter = () => {
    setTempFilters(activeFilters);
    setShowFilter(true);
  };
  
  const applyFilters = () => {
    setActiveFilters(tempFilters);
    setShowFilter(false);
  };
  
  const resetFilters = () => {
    const resetState = { dateFilter: 'all' as DateFilter, selectedTags: [], customDateFrom: today, customDateTo: today };
    setActiveFilters(resetState);
    setTempFilters(resetState);
    setShowFilter(false);
  };
  
  const toggleTag = (tagUuid: string) => {
    setTempFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagUuid)
        ? prev.selectedTags.filter(id => id !== tagUuid)
        : [...prev.selectedTags, tagUuid]
    }));
  };
  
  const setDateFilter = (filter: DateFilter) => {
    setTempFilters(prev => ({ ...prev, dateFilter: filter }));
  };
  
  const hasActiveFilters = activeFilters.dateFilter !== 'all' || activeFilters.selectedTags.length > 0;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  const getCustomDateLabel = () => {
    return `Od ${formatDate(tempFilters.customDateFrom)} do ${formatDate(tempFilters.customDateTo)}`;
  };
  
  const openDatePicker = (mode: 'from' | 'to') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setTempFilters(prev => ({
        ...prev,
        [datePickerMode === 'from' ? 'customDateFrom' : 'customDateTo']: dateStr
      }));
    }
  };

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
      onPress={() => router.push({ pathname: '/editMed', params: { editPackageId: item.package_uuid } })}
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
            <Pressable onPress={openFilter} style={styles.iconButton}>
              <Ionicons name="filter" size={18} color={hasActiveFilters ? COLORS.WHITE : COLORS.TEXT_MUTED} />
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
      
      {/* Filter Modal */}
      {showFilter && (
        <View style={styles.filterModal}>
          <View style={styles.filterContent}>
            <ScrollView style={styles.filterScrollArea} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterSectionTitle}>Data ważności</Text>
              
              {[
                { label: 'Wszystkie', value: 'all' },
                { label: 'Przeterminowane', value: 'expired' },
                { label: 'Wygasające w ciągu 30 dni', value: 'expiring30' },
                { label: 'Dłużej niż 30 dni', value: 'longer30' },
              ].map(item => (
                <Pressable
                  key={item.value}
                  onPress={() => setDateFilter(item.value as DateFilter)}
                  style={styles.filterOption}
                >
                  <View style={[styles.radioButton, tempFilters.dateFilter === item.value && styles.radioButtonSelected]} />
                  <Text style={styles.filterOptionText}>{item.label}</Text>
                </Pressable>
              ))}
              
              <Pressable
                onPress={() => setDateFilter('custom')}
                style={styles.filterOption}
              >
                <View style={[styles.radioButton, tempFilters.dateFilter === 'custom' && styles.radioButtonSelected]} />
                <View style={styles.customDateContainer}>
                  <Text style={styles.filterOptionText}>Od </Text>
                  <Text style={styles.dateText}>{formatDate(tempFilters.customDateFrom)}</Text>
                  <Pressable onPress={() => openDatePicker('from')} style={styles.calendarButtonInline}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.TEXT_MUTED} />
                  </Pressable>
                  <Text style={styles.filterOptionText}> do </Text>
                  <Text style={styles.dateText}>{formatDate(tempFilters.customDateTo)}</Text>
                  <Pressable onPress={() => openDatePicker('to')} style={styles.calendarButtonInline}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.TEXT_MUTED} />
                  </Pressable>
                </View>
              </Pressable>
              
              <Text style={[styles.filterSectionTitle, { marginTop: 32 }]}>Tagi</Text>
              
              <View style={styles.tagsContainer}>
                {allTags.map(tag => (
                  <Pressable
                    key={tag.uuid}
                    onPress={() => toggleTag(tag.uuid)}
                    style={[
                      styles.filterTag,
                      tempFilters.selectedTags.includes(tag.uuid) && styles.filterTagSelected
                    ]}
                  >
                    <Text style={[
                      styles.filterTagText,
                      tempFilters.selectedTags.includes(tag.uuid) && styles.filterTagTextSelected
                    ]}>
                      {tag.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            
            <View style={styles.filterButtons}>
              <Pressable style={[styles.filterBtn, styles.filterBtnReset]} onPress={resetFilters}>
                <Text style={styles.filterBtnText}>Resetuj</Text>
              </Pressable>
              <Pressable style={[styles.filterBtn, styles.filterBtnApply]} onPress={applyFilters}>
                <Text style={styles.filterBtnText}>Zastosuj</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      
      {showDatePicker && (
        <DateTimePicker
          value={new Date(datePickerMode === 'from' ? tempFilters.customDateFrom : tempFilters.customDateTo)}
          mode="date"
          onChange={handleDateChange}
        />
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
  
  // Filter styles
  filterModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContent: {
    backgroundColor: COLORS.BG,
    borderRadius: 12,
    width: '85%',
    maxHeight: '80%',
    flexDirection: 'column',
  },
  filterScrollArea: {
    padding: 24,
    paddingBottom: 0,
  },
  filterSectionTitle: {
    color: COLORS.TEXT_MUTED,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.TEXT_MUTED,
    marginRight: 12,
  },
  radioButtonSelected: {
    backgroundColor: COLORS.WHITE,
    borderColor: COLORS.WHITE,
  },
  filterOptionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  filterTag: {
    backgroundColor: COLORS.TAG,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.TAG,
  },
  filterTagSelected: {
    backgroundColor: COLORS.DANGER,
    borderColor: COLORS.DANGER,
  },
  filterTagText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  filterTagTextSelected: {
    color: COLORS.WHITE,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER_LIGHT,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterBtnReset: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.TEXT_MUTED,
  },
  filterBtnApply: {
    backgroundColor: COLORS.DANGER,
  },
  filterBtnText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  calendarButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '500',
  },
  calendarButtonInline: {
    padding: 2,
    marginLeft: 4,
  },
});