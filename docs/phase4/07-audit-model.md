# 07 - Immutable Audit Trail Architecture

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Immutable Audit Trail & Event Ledger Specification  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Immutable Ledger Principle

Platform menegaskan bahwa **Audit Log bersifat mutlak tidak dapat diubah (*Strictly Immutable*)**:

1. **`INSERT ONLY`**: Hanya operasi `INSERT` yang diperbolehkan pada tabel `audit_events`.
2. **`NO UPDATE`**: Operasi `UPDATE` dilarang keras di tingkat database trigger.
3. **`NO DELETE`**: Operasi `DELETE` dilarang keras di tingkat database trigger.

---

## 2. Event Ledger Schema Definition

```sql
CREATE TABLE audit_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    actor_id VARCHAR(64) NOT NULL REFERENCES user_actors(id),
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 3. Database Enforcement Strategy via PostgreSQL Triggers

Untuk mencegah manipulasi log audit dari aplikasi maupun akses database langsung:

```sql
-- Prevent UPDATE on audit_events
CREATE OR REPLACE FUNCTION block_audit_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Trail records are strictly immutable. UPDATE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_audit_update
BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION block_audit_update();

-- Prevent DELETE on audit_events
CREATE OR REPLACE FUNCTION block_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Trail records are strictly immutable. DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_audit_delete
BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION block_audit_delete();
```
