CREATE TABLE IF NOT EXISTS spam_call_reports (
  phone_number TEXT NOT NULL CHECK (phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  call_id TEXT NOT NULL,
  tactics JSONB NOT NULL DEFAULT '[]'::jsonb,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (phone_number, call_id)
);

CREATE INDEX IF NOT EXISTS spam_call_reports_phone_idx
  ON spam_call_reports (phone_number, reported_at DESC);

CREATE TABLE IF NOT EXISTS eval_feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  phone_number TEXT CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  model_probability DOUBLE PRECISION NOT NULL CHECK (model_probability BETWEEN 0 AND 1),
  model_risk_level TEXT NOT NULL CHECK (model_risk_level IN ('safe', 'caution', 'likely_fraud', 'critical')),
  kin_verdict TEXT NOT NULL CHECK (kin_verdict IN ('correct', 'false_alarm', 'missed_scam')),
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_feedback_submitted_at_idx
  ON eval_feedback (submitted_at DESC);
