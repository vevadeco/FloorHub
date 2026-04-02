-- Migration: add 2FA schema
-- Adds TOTP-based two-factor authentication tables and column to users.

-- Add totp_enabled flag to users table for fast login-time check (no join needed)
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Stores the TOTP secret per user.
-- enabled=false: secret generated but not yet verified (enrollment in progress)
-- enabled=true:  secret verified and 2FA is active
CREATE TABLE IF NOT EXISTS user_totp (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret      TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single-use backup codes. Each row is one code.
CREATE TABLE IF NOT EXISTS user_backup_codes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_backup_codes_user_id_idx ON user_backup_codes(user_id);
