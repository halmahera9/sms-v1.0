# Database & Storage Specification: Banyubiru Platform

## 1. Storage Strategy Progression
- **Current State (MVP / Prototype)**: Client-side LocalStorage abstraction layer (`loadProposals`, `getStoredStudents`).
- **Target State (Production Platform)**: Relational Database System (PostgreSQL / MariaDB) paired with Prisma ORM or Drizzle ORM for type-safe database queries.

## 2. Relational Schema Architecture

```sql
-- Core Platform Schema
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_code VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actor_id VARCHAR(36) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  details TEXT
);

-- Employee Domain Schema
CREATE TABLE employees (
  id VARCHAR(36) PRIMARY KEY,
  nip VARCHAR(50) UNIQUE NOT NULL,
  nrk VARCHAR(50) UNIQUE NOT NULL,
  nama VARCHAR(255) NOT NULL,
  jabatan VARCHAR(255) NOT NULL,
  unit_kerja VARCHAR(255) NOT NULL,
  wilayah VARCHAR(100) NOT NULL
);

CREATE TABLE award_proposals (
  id VARCHAR(36) PRIMARY KEY,
  employee_id VARCHAR(36) REFERENCES employees(id),
  jenis_penghargaan VARCHAR(50) NOT NULL,
  nilai_usulan VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Domain Schema
CREATE TABLE students (
  id VARCHAR(36) PRIMARY KEY,
  nisn VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL
);
```
