CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, ref_number TEXT UNIQUE NOT NULL,
 full_name TEXT NOT NULL, position_applied TEXT NOT NULL, email TEXT NOT NULL,
 phone TEXT NOT NULL, indos_number TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('processing','failed','submitted','under_review','shortlisted','rejected')),
 schema_version INTEGER NOT NULL, data_json TEXT NOT NULL,
 idempotency_hash TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
 cv_path TEXT, cv_name TEXT, cv_size INTEGER, docx_path TEXT,
 download_hash TEXT, download_expires INTEGER,
 submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_name ON applications(full_name);
CREATE INDEX IF NOT EXISTS applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS applications_indos ON applications(indos_number);
CREATE INDEX IF NOT EXISTS applications_position ON applications(position_applied);
CREATE INDEX IF NOT EXISTS applications_status_date ON applications(status,submitted_at DESC);
CREATE INDEX IF NOT EXISTS applications_download ON applications(download_hash);
CREATE TABLE IF NOT EXISTS application_audit (
 id INTEGER PRIMARY KEY, application_id TEXT, event TEXT NOT NULL,
 actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS application_notifications (
 application_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, sent_at TEXT
);
PRAGMA user_version = 1;
