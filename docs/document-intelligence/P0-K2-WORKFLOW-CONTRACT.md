# P0-K.2 — Canonical Document Intelligence Workflow Contract

**Status:** Contract proposal; belum diimplementasikan. Matriks pada bagian 3 adalah sumber kebenaran event dan perpindahan state. Event yang tidak tercantum adalah ilegal. Tidak ada perubahan state implisit.

## 1. Audit existing workflow

- Schema menyediakan `WorkflowInstance` dan `WorkflowTransition`, tenant-scoped; state masih free-form string. Instance unik pada `(tenantId, entityType, entityId)`. Lihat [schema](file:///c:/Users/USER/Documents/sms-v1.0/prisma/schema.prisma#L507-L545).
- [PlatformWorkflowEngine](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/workflow/engine.ts) mengevaluasi transisi in-memory; tidak melakukan persistence/audit.
- Workflow records dipakai bersama `ExceptionItem`; belum ada persisted document transition service canonical.
- `DocumentProcessingJob` memiliki `QUEUED/PROCESSING/COMPLETED/FAILED`, unique tenant+documentVersion, attempt counters; runner memakai atomic conditional SQL claim. Stale `PROCESSING` recovery tidak ditemukan.
- OCRExtraction, ExtractionResult, MatchingResult/Candidate masing-masing punya status/domain persistence. Matching memiliki unique keys/upsert. Tidak ditemukan integrasi runner yang mengorkestrasi P0-I `ExtractionResult` dan P0-J matcher.
- Audit repository existing adalah `PostgresAuditEventRepository`; unified work queue saat ini memproyeksikan pending ExtractedItem dan exception, bukan matching atau failed processing job.
- P0-J matcher mempertahankan keputusan manual untuk MatchingResult yang sama. P0-J.2 action belum menunjukkan CAS/locking untuk mencegah dua keputusan bersamaan.

Kesimpulan: state machine persisted, idempotency transition, concurrency control workflow, resume setelah crash, dan transition audit **belum tersedia**. Berikut ini kontrak usulan, bukan klaim fitur yang telah berjalan.

## 2. Unit workflow dan state

Satu WorkflowInstance mewakili satu versi dokumen: `(tenantId, documentVersionId)`; `documentId` adalah parent reference. Gunakan model workflow existing dengan entity type/version tersebut setelah validasi schema dan consumer; jangan membuat workflow engine/model kedua.

Workflow state adalah ringkasan orkestrasi. Status domain tetap dipunyai oleh Document/Version, OCRExtraction, ExtractionResult, MatchingResult, DocumentProcessingJob, dan manual decision P0-J.2. Jangan satukan status-status itu dalam satu enum.

State usulan:
`DITERIMA`, `SIAP_DIBACA`, `OCR_DIPROSES`, `SELESAI_DIBACA`, `SIAP_DIEKSTRAKSI`, `DIEKSTRAKSI`, `SELESAI_DIEKSTRAKSI`, `SIAP_DICOCOKKAN`, `DICOCOKKAN`, `MENUNGGU_KONFIRMASI`, `TERKONFIRMASI`, `TIDAK_DITEMUKAN`, `SELESAI`, `OCR_GAGAL`, `EKSTRAKSI_GAGAL`, `PENCOCOKAN_GAGAL`, `DIARSIPKAN`.

`PERLU_DIPERIKSA` adalah condition/projection turunan, bukan workflow state. State untuk human matching gate adalah `MENUNGGU_KONFIRMASI`; UI/queue dapat memakai label “Perlu Diperiksa”. `TIDAK_DITEMUKAN` terminal untuk keputusan matching versi tersebut, namun workflow baru `SELESAI` melalui event eksplisit jika semua gate lain beres. `SELESAI` berarti stage wajib selesai dan keputusan manusia yang diwajibkan sudah final.

## 3. State machine — matriks transisi canonical

Allow-list eksplisit; transisi tak tercantum ditolak tanpa persistence mutation. “Idempotensi” berlaku dengan key transition yang sama dan payload sama; retry attempt baru memakai key baru.

| State Saat Ini | Event | State Berikutnya | Syarat / guard | Idempotensi | Boleh Retry |
|---|---|---|---|---|---|
| `DITERIMA` | `SIAPKAN_PEMBACAAN` | `SIAP_DIBACA` | DocumentVersion valid, binary reference tersedia | Replay key sama mengembalikan hasil tersimpan | Ya sebelum stage dimulai |
| `SIAP_DIBACA` | `MULAI_OCR` | `OCR_DIPROSES` | Stage/job versi ini dapat diklaim; belum diarsipkan | Keyed; satu claim menang | Ya jika dikembalikan ke queued oleh retry policy |
| `OCR_DIPROSES` | `OCR_SELESAI` | `SELESAI_DIBACA` | OCRExtraction versi sama `COMPLETED`, output tersimpan | Replay tidak membuat OCR record/transition baru | Ya, replay hasil sama |
| `OCR_DIPROSES` | `OCR_GAGAL` | `OCR_GAGAL` | Error OCR persisted dan classified | Keyed | Ya melalui resume eksplisit |
| `OCR_GAGAL` | `ULANGI_OCR` | `SIAP_DIBACA` | Tidak archived; retry diizinkan; tidak menyentuh keputusan final | Keyed per attempt | Ya sesuai attempt policy |
| `SELESAI_DIBACA` | `SIAPKAN_EKSTRAKSI` | `SIAP_DIEKSTRAKSI` | OCR complete untuk documentVersion sama | Keyed | Ya sebelum ekstraksi dimulai |
| `SIAP_DIEKSTRAKSI` | `MULAI_EKSTRAKSI` | `DIEKSTRAKSI` | OCR complete; claim tunggal | Keyed, CAS | Ya bila belum final |
| `DIEKSTRAKSI` | `EKSTRAKSI_SELESAI` | `SELESAI_DIEKSTRAKSI` | ExtractionResult wajib telah tersimpan | Keyed; upsert P0-I key | Ya, replay tidak menggandakan result |
| `DIEKSTRAKSI` | `EKSTRAKSI_GAGAL` | `EKSTRAKSI_GAGAL` | Error persisted dan classified | Keyed | Ya melalui resume |
| `EKSTRAKSI_GAGAL` | `ULANGI_EKSTRAKSI` | `SIAP_DIEKSTRAKSI` | OCR valid; tidak menimpa keputusan manual | Keyed per attempt | Ya sesuai policy |
| `SELESAI_DIEKSTRAKSI` | `SIAPKAN_PENCOCOKAN` | `SIAP_DICOCOKKAN` | ExtractionResult siap; entity/field valid | Keyed | Ya sebelum matching |
| `SIAP_DICOCOKKAN` | `MULAI_PENCOCOKAN` | `DICOCOKKAN` | Tidak ada manual final decision; claim tunggal | Keyed, CAS | Ya sebelum keputusan final |
| `DICOCOKKAN` | `SATU_KANDIDAT_VALID` | `MENUNGGU_KONFIRMASI` | MatchingResult/candidate persist; policy memerlukan review | Keyed | Tidak otomatis; tunggu manusia |
| `DICOCOKKAN` | `BANYAK_KANDIDAT` | `MENUNGGU_KONFIRMASI` | Candidates persist; perlu keputusan operator | Keyed | Tidak otomatis; tunggu manusia |
| `DICOCOKKAN` | `TIDAK_ADA_KANDIDAT` | `TIDAK_DITEMUKAN` | MatchingResult `TIDAK_DITEMUKAN`, belum manual final | Keyed | Hanya explicit retry sebelum final decision |
| `DICOCOKKAN` | `PENCOCOKAN_GAGAL` | `PENCOCOKAN_GAGAL` | Error matcher persist; belum manual final | Keyed | Ya lewat resume |
| `PENCOCOKAN_GAGAL` | `ULANGI_PENCOCOKAN` | `SIAP_DICOCOKKAN` | Tidak manuallyConfirmed; extraction valid | Keyed per attempt | Ya sesuai policy |
| `MENUNGGU_KONFIRMASI` | `KONFIRMASI_KANDIDAT` | `TERKONFIRMASI` | RBAC; candidate milik result dan tenant; P0-J.2 menyimpan COCOK/candidate/user/time | Replay keputusan identik mengembalikan persisted decision | Tidak |
| `MENUNGGU_KONFIRMASI` | `TOLAK_SEMUA` | `TIDAK_DITEMUKAN` | RBAC; P0-J.2 menyimpan manual rejection/user/time | Replay keputusan identik mengembalikan persisted decision | Tidak |
| `TERKONFIRMASI` | `MULAI_ULANG` | `TERKONFIRMASI` | `manuallyConfirmed=true`; candidate/user/time dipertahankan | No-op/reuse, tanpa mutation/audit duplikat | Tidak |
| `TIDAK_DITEMUKAN` | `MULAI_ULANG` | `TIDAK_DITEMUKAN` | Manual final: preserve. Auto result: retry hanya lewat event retry eksplisit | Manual no-op; auto retry key baru | Manual: tidak; otomatis: explicit retry saja |
| `TERKONFIRMASI` | `SELESAIKAN_ALUR` | `SELESAI` | Semua stage/gate selesai; keputusan P0-J.2 unchanged | Keyed | Tidak perlu |
| `TIDAK_DITEMUKAN` | `SELESAIKAN_ALUR` | `SELESAI` | Keputusan matching tersimpan; gate lain resolved | Keyed | Tidak perlu |
| `SELESAI` | `ARSIPKAN` | `DIARSIPKAN` | Eligibility dan retention mengizinkan; temporary policy lolos | Keyed; operation replay-safe | Workflow transition tidak; operasi archive harus retry-safe |

Setiap state/event tidak tercantum di matriks adalah invalid. Menyimpan output stage saja tidak otomatis mengubah WorkflowInstance; event eksplisit harus memvalidasi bukti persistennya.

## 4. Transition service contract

Usulan API (belum diimplementasikan):

```ts
transitionDocumentWorkflow({
  documentId, documentVersionId, event, expectedState,
  actorId, idempotencyKey, correlationId, reason?,
})
```

`tenantId` hanya dari authenticated context; `actorId` dari context/identitas worker yang disetujui. `expectedState` adalah precondition CAS. Event wajib dalam matriks. Key dan correlation wajib; reason untuk failure/manual action sesuai policy. Response berisi persisted instance, from/to, transition ID, replay indicator, timestamp, correlation.

Transaksi: resolve instance tenant-scoped → cari key replay → conditional state update → insert WorkflowTransition → `PostgresAuditEventRepository.recordTx` → commit. Audit failure membatalkan transition. Engine generic boleh mengevaluasi matriks tetapi bukan persistence boundary.

## 5. Idempotensi

Key usulan `(tenantId, documentVersionId, event, idempotencyKey)` harus enforced service **dan database**. Schema WorkflowTransition sekarang belum menyediakan key/correlation; migration/schema review diperlukan pada fase implementasi.

- Replay key dan payload sama: return transition sebelumnya, tanpa state mutation, audit kedua, atau menjalankan stage kembali.
- Key sama/payload berbeda: conflict.
- Setelah A→B lalu B→C, request A→B dengan key lama hanya replay record; key baru ditolak karena expected state stale.
- Retry stage adalah attempt baru/key baru, tetapi output stage harus di-upsert menggunakan idempotency key domain.

| Operasi | Evidence/key | Safe retry |
|---|---|---|
| Intake | Random IDs/checksum; tidak ada request key | Deduplikasi request belum terkontrak |
| Job | Unique tenant+documentVersion | Reuse job, jangan buat kedua |
| OCR | Per-version identity diusulkan; schema tidak unique | Belum DB-safe untuk concurrent first create |
| Extraction | Unique tenant+OCR+field | Upsert per field |
| Matching | Unique matching result/candidate; matcher upsert | Aman hanya tanpa overwrite manual decision |
| Manual decision | Satu keputusan final per MatchingResult | Immutable; repeat identik reuse |
| Workflow transition | Tenant/version/event/key usulan | Unique persistence diperlukan |
| Audit | Satu event di transaksi transition | Replay tidak menulis event kedua |

## 6. Concurrency

Gunakan database transaction dan optimistic CAS pada WorkflowInstance dengan tenant, ID, dan `currentState=expectedState`; tepat satu update berhasil. Affected rows 0 adalah conflict. Unique transition idempotency key mencegah duplicate. Transition dan audit ditulis setelah CAS yang menang, dalam transaksi sama. Unique-key race dimuat ulang untuk menentukan replay/conflict.

Untuk keputusan P0-J.2, update harus conditional pada `manuallyConfirmed=false` atau memakai row lock kompatibel DB. Check-then-update saja tidak cukup. PostgreSQL conditional update/unique constraints sesuai fondasi; implementasinya belum ada.

## 7. Pipeline boundaries

```text
Document → DocumentVersion → OCRExtraction → ExtractionResult
          → MatchingResult → MatchingCandidate[]
          → Konfirmasi Manual (fields pada MatchingResult)
          → workflow completion projection
```

Workflow hanya mengorkestrasi lifecycle, validasi evidence dan transition; OCR engine, Ekstraksi Data, deterministic matcher, candidate ranking, serta keputusan manual tetap dimiliki service/domain masing-masing. Workflow tidak mengganti stage service atau membuat candidate/decision sendiri.

**GAP:** runner saat ini memanggil `DocumentIntelligenceOrchestrator` yang memakai OCRExtraction/ExtractedItem dan identity path lama; koneksi canonical ke P0-I ExtractionResult dan P0-J `matchDocumentIdentity` belum ditemukan. Contract ini tidak mengubah integrasi tersebut.

## 8. Failure dan resume

- Stage failure/error harus dipersist oleh pemilik stage sebelum event workflow failure.
- Transient infrastructure failure boleh bounded retry; deterministic invalid input/invariant tidak boleh blind retry.
- Resume dimulai dari stage terakhir yang sukses dan evidence-nya masih valid; tidak restart diam-diam dari intake.
- Jalur eksplisit: `OCR_DIPROSES→OCR_GAGAL→(ULANGI_OCR)→SIAP_DIBACA`; `DIEKSTRAKSI→EKSTRAKSI_GAGAL→(ULANGI_EKSTRAKSI)→SIAP_DIEKSTRAKSI`; `DICOCOKKAN→PENCOCOKAN_GAGAL→(ULANGI_PENCOCOKAN)→SIAP_DICOCOKKAN`.
- Retry reuse OCR per versi (constraint belum ada), upsert ExtractionResult, dan upsert MatchingResult/Candidate.
- Jika `manuallyConfirmed=true`, workflow mengembalikan keputusan persisted; tidak menjalankan path yang mengubah status/candidate/user/time.
- Runner bounded retry sudah ada; crash recovery untuk status `PROCESSING` belum ada.

## 9. Konfirmasi Manual protection

`MatchingCandidate` tetap kandidat; keputusan berada pada `MatchingResult.confirmedCandidateId` dan flag/actor/time. `TERKONFIRMASI` maupun manual `TIDAK_DITEMUKAN` adalah terminal terhadap matching. `MULAI_ULANG` hanya reuse/no-op dan tidak dapat mengubah keputusan. Matcher P0-J memiliki guard reuse pada result sama, tetapi workflow end-to-end dan concurrent mutation belum terbukti.

## 10. Audit contract

Gunakan `PostgresAuditEventRepository`, bukan repository baru. Canonical actions:

`DOCUMENT_WORKFLOW_STARTED`, `DOCUMENT_WORKFLOW_TRANSITIONED`, `DOCUMENT_WORKFLOW_RETRIED`, `DOCUMENT_WORKFLOW_FAILED`, `DOCUMENT_WORKFLOW_COMPLETED`, `DOCUMENT_WORKFLOW_REUSED`.

Setiap edge sukses menulis satu `DOCUMENT_WORKFLOW_TRANSITIONED`; event khusus boleh menyertai dalam transaksi yang sama sesuai konteks. Replay tidak menambah audit.

Metadata minimal: tenant, document, version, workflow instance/transition IDs, previous state, event, next state, actor, timestamp, idempotency key, correlation/reference ID, reason bila ada. Audit dan transition atomic; audit failure aborts transition.

## 11. Unified work queue contract

Perluas projection existing; jangan membuat queue engine baru. Proyeksikan state workflow + bukti stage/job: siap baca/ekstraksi/matching sebagai automatic action; state gagal sebagai retryable action; `MENUNGGU_KONFIRMASI` sebagai human action (“Perlu Diperiksa”). In-progress tidak boleh ditawarkan untuk duplicate claim. Final/resolved states tidak tampil sebagai pending.

Item key stabil per tenant+documentVersion+workflow action; satu item per unit/action. Retry mempertahankan item, bukan membuat duplicate. Manual review diprioritaskan atas retry otomatis; sort policy detail perlu disetujui. Item resolved berubah/hilang setelah transisi. Current UnifiedWorkQueue belum memproyeksikan workflow/matching/failed jobs—ini target kontrak.

## 12. Archival hand-off

```text
SELESAI → eligibility predicate → ARCHIVAL ELIGIBLE → ARSIPKAN → DIARSIPKAN
```

Eligibility mensyaratkan stage dan human gates selesai, retention policy/`retentionUntil` mengizinkan, dan `isTemporary` policy lolos. Pertahankan traceability `DocumentVersion.storageKey`, `checksumSha256`, `storageStatus`; set `archivedAt`/`archiveLocation` hanya oleh operasi archival masa depan. Arsip bukan delete; workflow selesai tidak menghapus atau memindahkan binary. Tidak ada archival engine, NAS, move, atau delete dalam contract ini.

## 13. Test contract (bukan hasil test runtime)

1. valid transition persist instance/transition/audit;
2. illegal/guard failure tidak mengubah persistence;
3. replay key/payload sama tanpa transition/audit kedua;
4. key sama/payload beda conflict;
5. dua concurrent transition menghasilkan satu pemenang;
6. retry tidak menduplikasi output stage;
7. resume dari failure boundary terakhir;
8. matcher rerun mempertahankan kedua tipe keputusan manual;
9. tenant isolation;
10. completion menolak gate yang belum selesai;
11. archival tidak menghapus/memutus checksum traceability;
12. satu work item per unit/action.

Tidak ada runtime test dijalankan. Concurrent DB scenarios: **NOT VERIFIED**.

## 14. GAP dan risiko terbuka

| Area | Existing | Gap / risiko |
|---|---|---|
| State | free-form string WorkflowInstance | allow-list dan instance DocumentVersion belum enforced |
| Idempotency | unique IDs, tanpa transition key | perlu key+unique database |
| Concurrency | job claim atomic | workflow CAS dan matching decision CAS belum ada |
| OCR | documentVersionId nullable, no unique tenant/version | concurrent OCR create/reuse belum dijamin |
| Extraction | P0-I schema unique, write path belum ditemukan | stage writer/evidence completion belum terhubung |
| Matching | P0-J matcher ada | runner belum memanggil canonical matcher |
| Manual wait | P0-J.2 ada | gate workflow dan policy completion rejection perlu disepakati |
| Resume | retry job terbatas | stale PROCESSING recovery tidak ada |
| Audit | audit repository ada | transition taxonomy/persistence belum ada |
| Queue | ExtractedItem + exception | matching, workflow, failed jobs belum diproyeksikan |
| Archival | metadata P0-G ada | eligibility predicate/engine belum ada |
| Multiple fields | result key per extraction/entity | aturan kelengkapan seluruh field belum ditetapkan |

GAP tersebut adalah kebutuhan fase berikutnya, bukan klaim bug pada implementasi yang belum dikontrak.

## 15. Explicit non-goals

Tidak mengimplementasikan transition service/repository/action, mengubah source/schema/migration, mengganti engine, menambah queue/worker, mengubah P0-G sampai P0-J.2, menambah AI/fuzzy, UI/notification, archival engine, pemindahan/penghapusan file, NAS/backup, atau menghapus compatibility code tanpa dependency audit.

## 16. Acceptance status

- Matriks eksplisit dengan guards, idempotency, retry: **defined in contract**.
- Event masuk/keluar allow-list: **defined; unlisted invalid**.
- Persisted transition, DB idempotency, CAS, audit runtime: **not implemented**.
- Concurrent transition tests dan end-to-end manual decision proof: **NOT VERIFIED**.
- Archival non-delete boundary: **contract defined; runtime not implemented**.

P0-K.2 menetapkan kontrak saja. Jangan laporkan runtime acceptance sebagai PASS sebelum fase implementasi dan test disetujui.
