-- ============================================================
--  SECURITY PASS — PostgreSQL Schema
--  Migration: 001_schema.sql
--  Version:   1.0.0  |  April 2026
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM TYPES ────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('admin', 'approver', 'gate', 'visitor');
CREATE TYPE pass_status    AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE pass_purpose   AS ENUM ('meeting', 'delivery', 'interview', 'audit', 'vendor', 'maintenance', 'other');
CREATE TYPE vehicle_type   AS ENUM ('Car', 'Bike', 'Truck', 'Van', 'Other');
CREATE TYPE log_type       AS ENUM ('entry', 'exit');
CREATE TYPE notif_status   AS ENUM ('unread', 'read');
CREATE TYPE notif_event    AS ENUM (
  'pass_pending', 'pass_approved', 'pass_rejected',
  'pass_entry', 'pass_exit', 'pass_expired', 'system'
);
CREATE TYPE id_type        AS ENUM ('Aadhaar', 'Passport', 'DL', 'Voter ID', 'PAN', 'Other');

-- ─── DEPARTMENTS ───────────────────────────────────────────
CREATE TABLE departments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  head_name   VARCHAR(100),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── USERS (Staff + Visitors) ──────────────────────────────
CREATE TABLE users (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  role            user_role    NOT NULL DEFAULT 'visitor',
  department_id   UUID         REFERENCES departments(id) ON DELETE SET NULL,
  designation     VARCHAR(100),
  employee_code   VARCHAR(50),
  avatar_url      VARCHAR(500),
  color           VARCHAR(7)   DEFAULT '#0891b2',
  initial         VARCHAR(3),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);

-- ─── VISITOR PROFILES (extended for non-staff) ─────────────
CREATE TABLE visitor_profiles (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company         VARCHAR(200),
  address         TEXT,
  govt_id_type    id_type,
  govt_id_number  VARCHAR(50),
  vehicle_number  VARCHAR(20),
  vehicle_type    vehicle_type,
  is_blacklisted  BOOLEAN      NOT NULL DEFAULT FALSE,
  blacklist_reason TEXT,
  total_visits    INTEGER      NOT NULL DEFAULT 0,
  last_visit_at   DATE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── SECURITY PASSES ───────────────────────────────────────
CREATE TABLE passes (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_number     VARCHAR(30)  NOT NULL UNIQUE,
  -- Visitor information
  visitor_name    VARCHAR(100) NOT NULL,
  visitor_phone   VARCHAR(20)  NOT NULL,
  visitor_email   VARCHAR(255),
  visitor_company VARCHAR(200),
  visitor_address TEXT,
  visitor_id      UUID         REFERENCES visitor_profiles(id) ON DELETE SET NULL,
  photo_url       VARCHAR(500),
  -- Govt ID
  govt_id_type    id_type,
  govt_id_number  VARCHAR(50),
  -- Vehicle
  vehicle_number  VARCHAR(20),
  vehicle_type    vehicle_type,
  -- Pass details
  purpose         pass_purpose NOT NULL,
  description     TEXT,
  notes           TEXT,
  valid_from      TIMESTAMPTZ  NOT NULL,
  valid_until     TIMESTAMPTZ  NOT NULL,
  -- Assignment
  host_user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  host_name       VARCHAR(100) NOT NULL,
  department_id   UUID         REFERENCES departments(id) ON DELETE SET NULL,
  department_name VARCHAR(100),
  -- Status
  status          pass_status  NOT NULL DEFAULT 'pending',
  -- QR
  qr_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
  qr_token        VARCHAR(64)  UNIQUE,
  qr_url          VARCHAR(500),
  -- Approval
  approved_by_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  approved_by_name VARCHAR(100),
  approved_at     TIMESTAMPTZ,
  rejected_by_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  reject_reason   TEXT,
  rejected_at     TIMESTAMPTZ,
  -- Metadata
  self_registered BOOLEAN      NOT NULL DEFAULT FALSE,
  requested_by_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_passes_number     ON passes(pass_number);
CREATE INDEX idx_passes_status     ON passes(status);
CREATE INDEX idx_passes_host       ON passes(host_user_id);
CREATE INDEX idx_passes_visitor_id ON passes(visitor_id);
CREATE INDEX idx_passes_valid      ON passes(valid_from, valid_until);
CREATE INDEX idx_passes_created    ON passes(created_at DESC);

-- ─── GATE LOGS ─────────────────────────────────────────────
CREATE TABLE gate_logs (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_id      UUID         NOT NULL REFERENCES passes(id) ON DELETE CASCADE,
  log_type     log_type     NOT NULL,
  gate_name    VARCHAR(100) NOT NULL DEFAULT 'Main Gate',
  logged_by_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  logged_by_name VARCHAR(100),
  remarks      TEXT,
  logged_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gate_logs_pass    ON gate_logs(pass_id);
CREATE INDEX idx_gate_logs_time    ON gate_logs(logged_at DESC);

-- ─── NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE notifications (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event           notif_event  NOT NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT         NOT NULL,
  pass_id         UUID         REFERENCES passes(id) ON DELETE SET NULL,
  status          notif_status NOT NULL DEFAULT 'unread',
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user    ON notifications(target_user_id);
CREATE INDEX idx_notif_status  ON notifications(target_user_id, status);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- ─── REFRESH TOKENS ────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_user   ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token  ON refresh_tokens(token_hash);

-- ─── AUDIT LOG ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  user_name   VARCHAR(100),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_logs(user_id);
CREATE INDEX idx_audit_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ─── PASS NUMBER SEQUENCE ──────────────────────────────────
CREATE SEQUENCE pass_number_seq START 1;

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_visitor_profiles_updated_at
  BEFORE UPDATE ON visitor_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_passes_updated_at
  BEFORE UPDATE ON passes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── PASS NUMBER GENERATOR ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_pass_number()
RETURNS VARCHAR AS $$
DECLARE
  today  TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  seq    INT  := NEXTVAL('pass_number_seq');
BEGIN
  RETURN 'SP-' || today || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ─── VIEWS ─────────────────────────────────────────────────
-- Active pass view with host info
CREATE VIEW v_passes AS
SELECT
  p.*,
  u.email          AS host_email,
  u.phone          AS host_phone,
  u.color          AS host_color,
  d.name           AS dept_name_full,
  (
    SELECT json_agg(
      json_build_object(
        'id',       gl.id,
        'type',     gl.log_type,
        'gate',     gl.gate_name,
        'guard',    gl.logged_by_name,
        'logged_at',gl.logged_at
      ) ORDER BY gl.logged_at
    )
    FROM gate_logs gl WHERE gl.pass_id = p.id
  ) AS gate_logs_json
FROM passes p
LEFT JOIN users       u ON u.id = p.host_user_id
LEFT JOIN departments d ON d.id = p.department_id;

-- Currently inside view
CREATE VIEW v_currently_inside AS
SELECT
  p.id           AS pass_id,
  p.pass_number,
  p.visitor_name,
  p.visitor_company,
  p.host_name,
  p.department_name,
  entry.gate_name,
  entry.logged_at AS entry_time,
  EXTRACT(EPOCH FROM (NOW() - entry.logged_at))/60 AS minutes_inside
FROM passes p
JOIN LATERAL (
  SELECT gl.gate_name, gl.logged_at
  FROM gate_logs gl
  WHERE gl.pass_id = p.id AND gl.log_type = 'entry'
  ORDER BY gl.logged_at DESC LIMIT 1
) entry ON TRUE
WHERE p.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM gate_logs gl2
    WHERE gl2.pass_id = p.id AND gl2.log_type = 'exit'
      AND gl2.logged_at > entry.logged_at
  );

-- Dashboard stats view
CREATE VIEW v_dashboard_stats AS
SELECT
  COUNT(*)                                                  AS total_passes,
  COUNT(*) FILTER (WHERE status = 'pending')                AS pending,
  COUNT(*) FILTER (WHERE status = 'approved')               AS approved,
  COUNT(*) FILTER (WHERE status = 'rejected')               AS rejected,
  COUNT(*) FILTER (WHERE status = 'approved'
    AND DATE(approved_at) = CURRENT_DATE)                   AS approved_today,
  COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)  AS created_today
FROM passes;
