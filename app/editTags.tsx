import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '../src/constants/theme';
import { execute, query } from '../src/database/db';

type Tag = {
  uuid: string;
  name: string;
};

export default function EditTagsScreen() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');

  const loadTags = useCallback(async () => {
    const result = await query<Tag>(
      'SELECT uuid, name FROM tags ORDER BY name COLLATE NOCASE ASC'
    );
    setTags(result);
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingTag || !editName.trim()) return;
    
    await execute(
      'UPDATE tags SET name = ? WHERE uuid = ?',
      [editName.trim(), editingTag.uuid]
    );
    
    setShowEditModal(false);
    setEditingTag(null);
    setEditName('');
    loadTags();
  };

  const deleteTag = async (tagUuid: string) => {
    await execute('BEGIN TRANSACTION');
    try {
      await execute('DELETE FROM meds_tags WHERE tag_uuid = ?', [tagUuid]);
      await execute('DELETE FROM meds_metadata_tags WHERE tag_uuid = ?', [tagUuid]);
      await execute('DELETE FROM tags WHERE uuid = ?', [tagUuid]);
      await execute('COMMIT');
      loadTags();
    } catch (error) {
      await execute('ROLLBACK');
      throw error;
    }
  };

  const renderTag = ({ item }: { item: Tag }) => (
    <View style={styles.tagItem}>
      <Text style={styles.tagName}>{item.name}</Text>
      <View style={styles.tagActions}>
        <Pressable onPress={() => openEditModal(item)} style={styles.actionBtn}>
          <Ionicons name="pencil" size={18} color={COLORS.TEXT_MUTED} />
        </Pressable>
        <Pressable onPress={() => deleteTag(item.uuid)} style={styles.actionBtn}>
          <Ionicons name="trash" size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>Brak tagów</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Edycja tagów</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tags List */}
      {tags.length > 0 ? (
        <FlatList
          data={tags}
          renderItem={renderTag}
          keyExtractor={(item) => item.uuid}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          indicatorStyle="white"
        />
      ) : (
        <EmptyState />
      )}

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nazwa tagu"
              placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
              autoFocus
            />
            <Pressable style={styles.saveButton} onPress={saveEdit}>
              <Text style={styles.saveButtonText}>Zapisz</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG_LIGHT,
  },
  
  header: {
    backgroundColor: COLORS.BG,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    minHeight: 110,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.TEXT_PLACEHOLDER_DARK,
  },
  backButton: {
    padding: 0,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  
  tagItem: {
    backgroundColor: COLORS.INPUT,
    padding: 16,
    borderRadius: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagName: {
    color: COLORS.WHITE,
    fontSize: 16,
    flex: 1,
  },
  tagActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 16,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.BG,
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.WHITE,
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
});