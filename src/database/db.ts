import * as SQLite from 'expo-sqlite';
import uuid from 'react-native-uuid';

let db: SQLite.SQLiteDatabase | null = null;

/** Wywołaj raz na starcie (np. w _app/_layout.tsx) */
export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('apteczka.db');

  const statements = [
    // --- tagi -------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS tags (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT UNIQUE NOT NULL
     );`,
    // --- produkty (metadane) ---------------------------------------
    `CREATE TABLE IF NOT EXISTS meds_metadata (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       description TEXT
     );`,
    // --- relacja produkt-tag (N-M) ---------------------------------
    `CREATE TABLE IF NOT EXISTS meds_metadata_tags (
       metadata_uuid TEXT NOT NULL,
       tag_uuid      TEXT NOT NULL,
       PRIMARY KEY (metadata_uuid, tag_uuid),
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE,
       FOREIGN KEY (tag_uuid)      REFERENCES tags(uuid)         ON DELETE CASCADE
     );`,
    // --- fizyczne opakowania ---------------------------------------
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

  for (const sql of statements) await assertDB().runAsync(sql);
}

/* -------- uniwersalne helpery ------------------------------------ */
function assertDB(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialised – call initDatabase() first');
  return db;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return await assertDB().getAllAsync<T>(sql, params);
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  await assertDB().runAsync(sql, params);
}

/* -------- operacje wyższego poziomu ------------------------------ */
export async function addTag(name: string): Promise<string> {
  const trimmed = name.trim();
  const dup = await query<{ uuid: string }>(
    `SELECT uuid FROM tags WHERE name = ? LIMIT 1`,
    [trimmed]
  );
  if (dup.length) return dup[0].uuid;

  const id = uuid.v4().toString();
  await execute(`INSERT INTO tags (uuid, name) VALUES (?, ?)`, [id, trimmed]);
  return id;
}

export async function addMedicationMetadata(
  name: string,
  description: string,
  tagIds: string[] = []
): Promise<string> {
  const id = uuid.v4().toString();
  await execute(
    `INSERT INTO meds_metadata (uuid, name, description) VALUES (?, ?, ?)`,
    [id, name.trim(), description.trim()]
  );
  for (const tagId of tagIds)
    await execute(
      `INSERT OR IGNORE INTO meds_metadata_tags (metadata_uuid, tag_uuid)
       VALUES (?, ?)`,
      [id, tagId]
    );
  return id;
}

export async function addMedicationPackage(
  metadataId: string,
  quantity: number | null,
  expirationISO: string | null
): Promise<string> {
  const id  = uuid.v4().toString();
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO meds
       (uuid, metadata_uuid, quantity, expiration_date, created_at, edited_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, metadataId, quantity, expirationISO, now, now]
  );
  return id;
}
