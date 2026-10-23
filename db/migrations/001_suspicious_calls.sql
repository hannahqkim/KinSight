CREATE TABLE IF NOT EXISTS suspicious_calls (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  caller_number TEXT,
  transcript_text TEXT NOT NULL,
  transcript_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  fraud_probability DOUBLE PRECISION NOT NULL CHECK (fraud_probability BETWEEN 0 AND 1),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('likely_fraud', 'critical')),
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  plain_language_warning TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  model_version TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'suspicious'
    CHECK (review_status IN ('suspicious', 'confirmed_fraud', 'false_positive')),
  first_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suspicious_calls_phone_e164
    CHECK (caller_number IS NULL OR caller_number ~ '^\+[1-9][0-9]{6,14}$')
);

CREATE INDEX IF NOT EXISTS suspicious_calls_caller_number_idx
  ON suspicious_calls (caller_number)
  WHERE caller_number IS NOT NULL AND review_status <> 'false_positive';

CREATE INDEX IF NOT EXISTS suspicious_calls_review_status_idx
  ON suspicious_calls (review_status);
