// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import uuid from 'react-native-uuid';

let db: SQLite.SQLiteDatabase | null = null;

/** Wywołaj raz przy starcie (np. w _layout.tsx) */
export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('apteczka.db');

  // lista poleceń CREATE do wykonania po kolei
  const statements = [
    `CREATE TABLE IF NOT EXISTS tags (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT UNIQUE NOT NULL
     );`,

    `CREATE TABLE IF NOT EXISTS meds_metadata (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       description TEXT
     );`,

    `CREATE TABLE IF NOT EXISTS meds_metadata_tags (
       metadata_uuid TEXT NOT NULL,
       tag_uuid      TEXT NOT NULL,
       PRIMARY KEY (metadata_uuid, tag_uuid),
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE,
       FOREIGN KEY (tag_uuid)      REFERENCES tags(uuid)         ON DELETE CASCADE
     );`,

    `CREATE TABLE IF NOT EXISTS meds (
       uuid            TEXT PRIMARY KEY NOT NULL,
       metadata_uuid   TEXT NOT NULL,
       quantity        INTEGER,
       expiration_date TEXT,
       created_at      TEXT,
       edited_at       TEXT,
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE
     );`,
  ];

  for (const sql of statements) {
    try {
      await db.runAsync(sql);
    } catch (err: any) {
      console.error('❌ SQL error:', err?.message, '\n---\n', sql);
      throw err;                           // przerwie initDatabase i poleci do catch w _layout
    }
  }
}


/* ----------  Helpery  ---------- */

function assertDB(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialised – call initDatabase() first');
  return db;
}

/** Dodaje tag, zwraca uuid */
export async function addTag(name: string): Promise<string> {
  const id = uuid.v4().toString();
  await assertDB().runAsync(`INSERT INTO tags (uuid, name) VALUES (?, ?)`, [id, name]);
  return id;
}

/** Dodaje metadane leku + przypisuje tagi */
export async function addMedicationMetadata(
  name: string,
  description: string,
  tagIds: string[] = []
): Promise<string> {
  const id = uuid.v4().toString();
  const dbi = assertDB();
  await dbi.runAsync(
    `INSERT INTO meds_metadata (uuid, name, description) VALUES (?, ?, ?)`,
    [id, name, description]
  );
  for (const tagId of tagIds) {
    await dbi.runAsync(
      `INSERT OR IGNORE INTO meds_metadata_tags (metadata_uuid, tag_uuid) VALUES (?, ?)`,
      [id, tagId]
    );
  }
  return id;
}

/** Dodaje fizyczne opakowanie */
export async function addMedicationPackage(
  metadataId: string,
  quantity: number | null,
  expirationISO: string | null
): Promise<string> {
  const id = uuid.v4().toString();
  const now = new Date().toISOString();
  await assertDB().runAsync(
    `INSERT INTO meds
       (uuid, metadata_uuid, quantity, expiration_date, created_at, edited_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, metadataId, quantity, expirationISO, now, now]
  );
  return id;
}

/** Uniwersalny SELECT – zwraca tablicę rekordów */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return await assertDB().getAllAsync<T>(sql, params);
}
