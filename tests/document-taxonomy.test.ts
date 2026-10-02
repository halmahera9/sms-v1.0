import assert from 'node:assert';
import { DocumentCategory } from '@prisma/client';
import {
  DOCUMENT_TAXONOMY,
  getDocumentTaxonomy,
  getAllDocumentTaxonomies,
  getDocumentFieldSchema,
} from '@/platform/config/document-taxonomy';

console.log('================================================================');
console.log(' CANONICAL SCHOOL DOCUMENT TAXONOMY TEST SUITE                  ');
console.log('================================================================\n');

const EXPECTED_CATEGORIES: DocumentCategory[] = [
  'KARTU_KELUARGA',
  'KTP',
  'AKTA_KELAHIRAN',
  'IJAZAH',
  'RAPOR',
  'SERTIFIKAT',
  'SURAT_PERNYATAAN',
  'SURAT_PERMOHONAN',
  'SURAT_TUGAS',
  'SURAT_KEPUTUSAN',
  'LAINNYA',
];

// Section 1: Exact Minimal Canonical Taxonomy
console.log('--- SECTION 1: Minimal Canonical Taxonomy Completeness ---');
const definedCategories = Object.keys(DOCUMENT_TAXONOMY);
assert.strictEqual(
  definedCategories.length,
  EXPECTED_CATEGORIES.length,
  `Exactly ${EXPECTED_CATEGORIES.length} categories must be defined, found ${definedCategories.length}`
);

for (const cat of EXPECTED_CATEGORIES) {
  assert(DOCUMENT_TAXONOMY[cat], `Category ${cat} must exist in DOCUMENT_TAXONOMY`);
  assert.strictEqual(DOCUMENT_TAXONOMY[cat].code, cat, `${cat} code matches`);
  assert.strictEqual(DOCUMENT_TAXONOMY[cat].key, cat, `${cat} key matches`);
  assert(DOCUMENT_TAXONOMY[cat].displayName.length > 0, `${cat} must have displayName`);
  assert(DOCUMENT_TAXONOMY[cat].description.length > 0, `${cat} must have description`);
  assert(typeof DOCUMENT_TAXONOMY[cat].requiresIdentityMatching === 'boolean', `${cat} requiresIdentityMatching must be boolean`);
  assert(typeof DOCUMENT_TAXONOMY[cat].requiresHumanVerification === 'boolean', `${cat} requiresHumanVerification must be boolean`);
  assert(Array.isArray(DOCUMENT_TAXONOMY[cat].fields), `${cat} fields must be an array`);
}
console.log('✓ All 11 canonical school categories defined with valid metadata contracts');

// Section 2: Zero Legacy Categories
console.log('\n--- SECTION 2: Absence of Legacy Award Enums ---');
const legacyValues = ['SK_CPNS', 'SK_PNS', 'SK_JABATAN', 'SKP_2_TAHUN', 'SURAT_PENGANTAR', 'DP3', 'IDENTITAS', 'FOTO'];
for (const legacy of legacyValues) {
  assert(!(legacy in DOCUMENT_TAXONOMY), `Legacy enum ${legacy} must NOT exist in DOCUMENT_TAXONOMY`);
  assert(!(legacy in DocumentCategory), `Legacy enum ${legacy} must NOT exist in Prisma DocumentCategory`);
}
console.log('✓ Verified 0 residual legacy categories in taxonomy');

// Section 3: Document Intelligence Field Schemas
console.log('\n--- SECTION 3: Document Field Schema Resolution ---');
const kkFields = getDocumentFieldSchema('KARTU_KELUARGA');
assert(kkFields.length > 0, 'KARTU_KELUARGA must have field definitions');
assert(kkFields.some(f => f.key === 'nomor_kk'), 'KK must have nomor_kk');
assert(kkFields.some(f => f.key === 'nik'), 'KK must have nik');

const ktpFields = getDocumentFieldSchema('KTP');
assert(ktpFields.some(f => f.key === 'nik'), 'KTP must have nik');
assert(ktpFields.some(f => f.key === 'nama'), 'KTP must have nama');

const raporFields = getDocumentFieldSchema('rapor');
assert(raporFields.some(f => f.key === 'nisn'), 'Rapor must resolve case-insensitively and contain nisn');

const unkFields = getDocumentFieldSchema('UNKNOWN_TYPE');
assert.deepStrictEqual(unkFields, [], 'Unknown type returns empty field array');
console.log('✓ Field schema resolution verified');

// Section 4: getAllDocumentTaxonomies & getDocumentTaxonomy
console.log('\n--- SECTION 4: Lookup API Functions ---');
const all = getAllDocumentTaxonomies();
assert.strictEqual(all.length, 11, 'getAllDocumentTaxonomies returns all 11 definitions');

const kk = getDocumentTaxonomy('kartu_keluarga');
assert.strictEqual(kk?.code, 'KARTU_KELUARGA', 'Case-insensitive lookup resolves KK');

const ktp = getDocumentTaxonomy('KTP');
assert.strictEqual(ktp?.requiresIdentityMatching, true, 'KTP requires identity matching');

console.log('✓ Lookup helper functions verified');

console.log('\n================================================================');
console.log(' ALL TAXONOMY TESTS PASSED                                      ');
console.log('================================================================\n');
