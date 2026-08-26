# UI & Design System Specification: Banyubiru Intelligence

## 1. Design Principles
- **Rich & Modern Aesthetics**: Modern dark/light theme options using Tailwind CSS v4, sleek card surfaces, vibrant status badges, glassmorphism, and clear micro-interactions.
- **Dynamic Layout & Accessibility**: High-scannability data tables with fuzzy search, multi-faceted filtering, modal dialogs for verification, and progress steps.

## 2. Layout Structure & Design Tokens
- **Primary Color Palette**: Deep Navy / Slate background (`bg-slate-900`), Royal Blue accent (`bg-blue-600`), Emerald for success/verified (`bg-emerald-600`), Amber for pending/exceptions (`bg-amber-500`).
- **Typography**: Inter / Geist Sans for clear tabular and body readability; Geist Mono for NIP, NRK, NISN, and IDs.
- **Component Architecture**:
  - `Header`: Unified domain switcher, status counters, and RBAC role toggle.
  - `DashboardOverview`: High-level metrics, pipeline status visualization, distribution charts.
  - `CandidateList` / `RecordList`: Data tables with fuzzy search, filters, pagination.
  - `VerificationModal`: Document inspection & approval checklist.
  - `DocumentGenerator`: Batch export & single recommendation letter compiler.
