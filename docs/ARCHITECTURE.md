# System Architecture: Banyubiru Administrative Intelligence Platform

## 1. High-Level Architecture
The platform is structured into two primary layers: **Core Platform Services** (Domain-Agnostic) and **Domain Modules** (Plug-and-Play Domain Extensions).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION LAYER                              │
│         Next.js App Router (React 19) • Design System • Server/Client Components │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌────────────────────────────────────────┐ ┌──────────────────────────────────┐
│      EMPLOYEE ADMIN DOMAIN MODULE      │ │   STUDENT ADMIN DOMAIN MODULE    │
│  - Award Proposals (Masa Kerja/Satya) │ │  - Student Records (Dapodik)     │
│  - Document Requirements & Rules       │ │  - Absence OCR Extraction        │
└──────────────────────┬─────────────────┘ └──────────────────┬───────────────┘
                       │                              │
                       └──────────────┬───────────────┘
                                      │ (Interfaces & Handlers)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE PLATFORM SERVICES                            │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │  Auth & User RBAC    │ │  Workflow Engine     │ │ Validation Engine    │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ Rule / Policy Model  │ │ Exception Queue      │ │ Approval Engine      │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ Document Generator   │ │ Audit Trail System   │ │ Notification System  │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Platform Core Services Architecture

1. **Authentication & RBAC**: Identity resolution, roles (Admin, Verifier, Operator, Viewer), and resource-level permissions.
2. **Data Normalization Engine**: Ingestion pipeline transforming raw Excel, CSV, or OCR JSON payloads into canonical schemas.
3. **Rule / Policy Model Engine**: Configurable, JSON/code-based policy registry separating business constraints from UI code.
4. **Validation Engine**: Evaluates canonical entities against active policy rules to determine compliance status.
5. **Exception Queue Manager**: Traps validation failures, unmapped fields, or missing documents into a queue for human intervention.
6. **Workflow & Approval Engine**: Manages state transitions (`DRAFT` ➔ `PENDING_VERIFICATION` ➔ `VERIFIED` ➔ `APPROVED` ➔ `COMPLETED`).
7. **Document Generator Service**: Template-based PDF/DOCX compiler.
8. **Audit Trail Engine**: Immutable event-sourcing logger capturing actor, action, timestamp, entity, and diff metadata.

## 3. Technology Stack
- **Framework**: Next.js 16.3.1 (App Router + Turbopack)
- **UI & Runtime**: React 19.2.8, Tailwind CSS v4, Lucide React Icons
- **Utility Libraries**: `xlsx` (Excel Processing), `jspdf` & `jspdf-autotable` (PDF Generation), `fuse.js` (Fuzzy Search)
- **Language**: TypeScript 5 (Strict Mode)
