
Banyubiru Design System
Product Direction

Banyubiru is designed as an institutional administrative intelligence platform.

The interface prioritizes:

clarity
operational density
predictable navigation
fast data review
explicit workflow state
minimal visual noise
clear action hierarchy
Visual Language

Primary visual characteristics:

institutional
modern SaaS
clean
desktop-first operational workspace
responsive
dark/light surface support where applicable
strong blue identity
Navigation

Primary application navigation:

Beranda
Proses
Dokumen
Analitik
Siswa

Student Administration

The Student workspace is an operational master-data interface.

Primary student actions:

Master Data Siswa
Dokumen & OCR
Verifikasi Data
Kehadiran
Ekspor & Rekap

Student records use a compact operational table with deeper information
available through Preview and Edit.

Preview is read-oriented and must not mutate master data.

Edit is intended for controlled manual correction.

Dapodik Update Workflow

Dapodik is the primary bulk synchronization mechanism.

The intended interaction is:

Select Excel
    ↓
Preview
    ↓
Review Changes
    ↓
Administrative Approval
    ↓
Apply

The preview should clearly distinguish:

UNCHANGED
FILL_BLANK
CONFLICT
NEW

Administrative review is required before NEW records are inserted.

Existing master values must not be silently overwritten by Dapodik data.

Supporting navigation:

Generator
Riwayat
Pengaturan
Operational UI

The application should distinguish:

Information
↓
Current State
↓
Required Action
↓
Confirmation

Actions that modify administrative records must be visually explicit.

Verification Interface

The verification workspace consists of:

Document Selector
        ↓
Original Document Preview
        ↓
OCR / Matching Results
        ↓
Operator Action
        ↓
Verification Result

Each extracted item should expose:

OCR text
matched student
class
absence status
confidence
verification action
exception state when applicable
Design Principle

Do not hide workflow state behind decorative UI.

An operator should immediately understand:

What document is being processed.
How many extracted items exist.
Which items are unresolved.
Which student was matched.
What action is required.
What will happen after confirmation.
