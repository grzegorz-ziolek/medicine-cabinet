import * as SQLite from 'expo-sqlite';
import uuid from 'react-native-uuid';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('apteczka.db');

  const statements = [
    // Tags
    `CREATE TABLE IF NOT EXISTS tags (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT UNIQUE NOT NULL
     );`,
    // Products metadata
    `CREATE TABLE IF NOT EXISTS meds_metadata (
       uuid TEXT PRIMARY KEY NOT NULL,
       name TEXT NOT NULL,
       description TEXT,
       product_id TEXT,
       product_name TEXT,
       previous_name TEXT,
       administration_route TEXT,
       strength TEXT,
       pharmaceutical_form TEXT,
       active_substance TEXT,
       leaflet TEXT,
       label_leaflet TEXT
     );`,
    // Products <> Barcodes
    `CREATE TABLE IF NOT EXISTS meds_packaging (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       metadata_uuid TEXT NOT NULL,
       barcode TEXT NOT NULL,
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE
     );`,
    // Product <> Tags
    `CREATE TABLE IF NOT EXISTS meds_metadata_tags (
       metadata_uuid TEXT NOT NULL,
       tag_uuid      TEXT NOT NULL,
       PRIMARY KEY (metadata_uuid, tag_uuid),
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE,
       FOREIGN KEY (tag_uuid)      REFERENCES tags(uuid)         ON DELETE CASCADE
     );`,
     // Meds
    `CREATE TABLE IF NOT EXISTS meds (
       uuid            TEXT PRIMARY KEY NOT NULL,
       metadata_uuid   TEXT NOT NULL,
       quantity        INTEGER,
       expiration_date DATETIME,
       created_at      DATETIME,
       edited_at       DATETIME,
       FOREIGN KEY (metadata_uuid) REFERENCES meds_metadata(uuid) ON DELETE CASCADE
     );`,
    // Meds <> Tags
    `CREATE TABLE IF NOT EXISTS meds_tags (
       package_uuid TEXT NOT NULL,
       tag_uuid     TEXT NOT NULL,
       PRIMARY KEY (package_uuid, tag_uuid),
       FOREIGN KEY (package_uuid) REFERENCES meds(uuid) ON DELETE CASCADE,
       FOREIGN KEY (tag_uuid)     REFERENCES tags(uuid) ON DELETE CASCADE
     );`,
  ];

  for (const sql of statements) await assertDB().runAsync(sql);
  
  // Migration
  const migrations = [
    'ALTER TABLE meds_metadata ADD COLUMN product_id TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN product_name TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN previous_name TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN administration_route TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN strength TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN pharmaceutical_form TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN active_substance TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN leaflet TEXT',
    'ALTER TABLE meds_metadata ADD COLUMN label_leaflet TEXT'
  ];

  try {
    await assertDB().runAsync(`CREATE TABLE IF NOT EXISTS meds_tags (
       package_uuid TEXT NOT NULL,
       tag_uuid     TEXT NOT NULL,
       PRIMARY KEY (package_uuid, tag_uuid),
       FOREIGN KEY (package_uuid) REFERENCES meds(uuid) ON DELETE CASCADE,
       FOREIGN KEY (tag_uuid)     REFERENCES tags(uuid) ON DELETE CASCADE
     )`);
  } catch (e) {
  }
  
  try {
    await assertDB().runAsync('ALTER TABLE meds_metadata DROP COLUMN packaging');
  } catch (e) {
  }
  
  for (const migration of migrations) {
    try {
      await assertDB().runAsync(migration);
    } catch (e) {
    }
  }
}

// Helpers
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

export function getDB() {
  return assertDB();
}


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

async function parseAndInsertPackaging(metadataUuid: string, packagingText: string): Promise<void> {
  if (!packagingText?.trim()) return;
  
  const lines = packagingText.split('\n').map(line => line.trim()).filter(line => line);
  
  for (const line of lines) {
    if (line.includes('¦')) {
      const barcode = line.split('¦')[0]?.trim();
      if (barcode && /^\d+$/.test(barcode)) {
        await execute(
          `INSERT INTO meds_packaging (metadata_uuid, barcode) VALUES (?, ?)`,
          [metadataUuid, barcode]
        );
      }
    }
  }
}

export async function importMedicineFromCSV(
  name: string,
  description: string,
  productId: string,
  productName: string,
  previousName: string,
  administrationRoute: string,
  strength: string,
  pharmaceuticalForm: string,
  packaging: string,
  activeSubstance: string,
  leaflet: string,
  labelLeaflet: string
): Promise<void> {
  const existing = await query<{ uuid: string; description: string }>(
    `SELECT uuid, description FROM meds_metadata WHERE name = ? LIMIT 1`,
    [name.trim()]
  );
  
  let metadataUuid: string;
  
  if (existing.length) {
    metadataUuid = existing[0].uuid;
    const mergedDesc = existing[0].description ? `${existing[0].description}\n\n${description}` : description;
    await execute(
      `UPDATE meds_metadata SET 
        description = ?, product_id = ?, product_name = ?, previous_name = ?,
        administration_route = ?, strength = ?, pharmaceutical_form = ?,
        active_substance = ?, leaflet = ?, label_leaflet = ?
       WHERE uuid = ?`,
      [mergedDesc, productId, productName, previousName, administrationRoute, 
       strength, pharmaceuticalForm, activeSubstance, leaflet, labelLeaflet, metadataUuid]
    );
    // Clear existing packaging data
    await execute(`DELETE FROM meds_packaging WHERE metadata_uuid = ?`, [metadataUuid]);
  } else {
    metadataUuid = uuid.v4().toString();
    await execute(
      `INSERT INTO meds_metadata 
        (uuid, name, description, product_id, product_name, previous_name,
         administration_route, strength, pharmaceutical_form,
         active_substance, leaflet, label_leaflet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [metadataUuid, name.trim(), description, productId, productName, previousName,
       administrationRoute, strength, pharmaceuticalForm,
       activeSubstance, leaflet, labelLeaflet]
    );
  }
  
  await parseAndInsertPackaging(metadataUuid, packaging);
}

export async function findMedicineByBarcode(barcode: string): Promise<{
  uuid: string;
  name: string;
  description: string;
  product_name: string;
} | null> {
  const result = await query<{
    uuid: string;
    name: string;
    description: string;
    product_name: string;
  }>(
    `SELECT DISTINCT m.uuid, m.name, m.description, m.product_name 
     FROM meds_metadata m 
     JOIN meds_packaging p ON m.uuid = p.metadata_uuid 
     WHERE p.barcode LIKE '%' || ?`,
    [barcode]
  );
  
  if (result.length === 0) return null;
  if (result.length > 1) throw new Error('Multiple matches found');
  
  return result[0];
}
