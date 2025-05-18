// src/database/seed.ts
import { addMedicationMetadata, addMedicationPackage, addTag, query } from './db';

/** Dodaje przykładowe rekordy tylko jeżeli w bazie jest pusto */
export async function seedDemoData(): Promise<void> {
  const existing = await query('SELECT COUNT(*) AS cnt FROM meds;');
  if (existing[0].cnt > 0) return;              // już są dane — wychodzimy

  // === TAGI ===
  const painId   = await addTag('ból głowy');
  const coldId   = await addTag('przeziębienie');
  const allergyId = await addTag('alergia');

  // === METADATA + opakowania ===
  const ibuprofenMeta = await addMedicationMetadata(
    'Ibuprofen 200 mg',
    'tabletki przeciwbólowe i przeciwgorączkowe',
    [painId]
  );
  await addMedicationPackage(ibuprofenMeta, 24, '2025-03-31');

  const paracetamolMeta = await addMedicationMetadata(
    'Paracetamol 500 mg',
    'lek przeciwbólowy i przeciwgorączkowy',
    [painId, coldId]
  );
  await addMedicationPackage(paracetamolMeta, 10, '2024-12-15');

  const cetirizineMeta = await addMedicationMetadata(
    'Cetirizyna 10 mg',
    'tabletki na alergię',
    [allergyId]
  );
  await addMedicationPackage(cetirizineMeta, 30, '2026-05-20');

  console.log('💊  Demo data seeded!');
}
