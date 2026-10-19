CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  purchase_date DATE NOT NULL,
  warranty_months INTEGER NOT NULL CHECK (warranty_months BETWEEN 0 AND 120),
  room TEXT NOT NULL DEFAULT 'Not specified',
  condition TEXT NOT NULL DEFAULT 'Needs attention',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manuals (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_note TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  safety_level TEXT NOT NULL CHECK (safety_level IN ('low', 'medium', 'high')),
  keywords TEXT NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Keep existing local databases compatible with the explicit evidence-trust field.
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE manuals ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS manuals_device_id_idx ON manuals(device_id);
CREATE INDEX IF NOT EXISTS manuals_search_idx ON manuals USING GIN (to_tsvector('english', title || ' ' || section || ' ' || excerpt || ' ' || keywords));

CREATE TABLE IF NOT EXISTS repair_cases (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  issue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'In progress', 'Resolved', 'Closed')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  warranty_state TEXT NOT NULL,
  summary TEXT NOT NULL,
  resolution TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ NOT NULL,
  session_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS repair_cases_created_at_idx ON repair_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS repair_cases_device_idx ON repair_cases(device_id);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES repair_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_events_case_idx ON case_events(case_id, created_at ASC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conversation_messages_session_idx ON conversation_messages(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS approval_tokens (
  token_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  issue_hash TEXT NOT NULL,
  draft_hash TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Existing unused tokens are invalidated by the empty legacy default; newly issued tokens bind the exact draft.
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS draft_hash TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS approval_tokens_expiry_idx ON approval_tokens(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  arguments_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
