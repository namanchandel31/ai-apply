-- Provider-agnostic connected email accounts (Gmail OAuth now; Outlook/M365/SMTP future).
-- Replaces the single-purpose user_email_credentials table for OAuth, while that
-- table stays intact for existing SMTP app-password users (resolved as a fallback).
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'm365', 'smtp')),
  auth_method TEXT NOT NULL CHECK (auth_method IN ('oauth2', 'app_password')),
  email_address TEXT NOT NULL,
  -- Stable provider identity (Google `sub`); lets us detect account swaps.
  provider_account_id TEXT,
  -- Connection / authorization lifecycle: is the grant valid?
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
  -- Operational health: are sends/refreshes currently succeeding? Distinct from status.
  health_status TEXT NOT NULL DEFAULT 'healthy'
    CHECK (health_status IN ('healthy', 'degraded', 'unhealthy')),
  -- The account used for sending (at most one default per user — see partial index).
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  -- Scopes Google actually granted (least-privilege tracking + capability derivation).
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  can_send BOOLEAN NOT NULL DEFAULT FALSE,
  can_read BOOLEAN NOT NULL DEFAULT FALSE,
  -- Tokens encrypted at rest (AES-256-GCM); never stored or logged in plaintext.
  encrypted_refresh_token TEXT,
  encrypted_access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  last_connected_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  -- Updated after every successful send regardless of provider (Gmail or SMTP).
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Supports multiple accounts / providers per user.
  UNIQUE (user_id, provider, email_address)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user
  ON email_accounts (user_id);

-- At most one default sending account per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_accounts_one_default_per_user
  ON email_accounts (user_id) WHERE is_default;

-- Keep updated_at fresh (function defined in 005_indexes_and_constraints.sql).
DROP TRIGGER IF EXISTS trg_email_accounts_updated_at ON email_accounts;
CREATE TRIGGER trg_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Operational/audit trail for provider integrations. NOT source-of-truth state —
-- the authoritative connection state lives on email_accounts. Append-only.
CREATE TABLE IF NOT EXISTS email_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nullable so events survive account deletion (history retention).
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- Never store tokens here.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_provider_events_user
  ON email_provider_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_provider_events_account
  ON email_provider_events (email_account_id, created_at DESC);

-- Future read-tier checkpointing (Gmail History API / watch). Created now to avoid
-- a future migration; UNUSED until reply tracking / inbox sync ships.
CREATE TABLE IF NOT EXISTS email_account_sync_state (
  account_id UUID PRIMARY KEY REFERENCES email_accounts(id) ON DELETE CASCADE,
  last_history_id TEXT,
  watch_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  cursor JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
