/**
 * Sea & Seas Shipping Private Limited
 * Seafarer Bio-Data Applications Database Layer
 * Uses Node.js native embedded SQLite (DatabaseSync)
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'applications.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS seafarer_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    position_applied TEXT NOT NULL,
    rank_lower_acceptable TEXT DEFAULT 'NO',
    date_availability TEXT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    indos_number TEXT,
    cdc_number TEXT,
    passport_number TEXT,
    nationality TEXT DEFAULT 'Indian',
    dob TEXT,
    status TEXT DEFAULT 'submitted',
    cv_original_name TEXT,
    cv_stored_path TEXT,
    cv_size_kb INTEGER DEFAULT 0,
    generated_docx_path TEXT,
    generated_docx_filename TEXT,
    download_token TEXT UNIQUE,
    raw_data_json TEXT NOT NULL,
    ip_address TEXT,
    submitted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_apps_ref ON seafarer_applications(ref_number);
  CREATE INDEX IF NOT EXISTS idx_apps_email ON seafarer_applications(email);
  CREATE INDEX IF NOT EXISTS idx_apps_phone ON seafarer_applications(phone);
  CREATE INDEX IF NOT EXISTS idx_apps_indos ON seafarer_applications(indos_number);
  CREATE INDEX IF NOT EXISTS idx_apps_pos ON seafarer_applications(position_applied);
  CREATE INDEX IF NOT EXISTS idx_apps_token ON seafarer_applications(download_token);
  CREATE INDEX IF NOT EXISTS idx_apps_submitted ON seafarer_applications(submitted_at DESC);
`);

/**
 * Insert new application record
 */
function createApplication(data) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO seafarer_applications (
      ref_number, full_name, position_applied, rank_lower_acceptable,
      date_availability, email, phone, indos_number, cdc_number,
      passport_number, nationality, dob, status, cv_original_name,
      cv_stored_path, cv_size_kb, generated_docx_path, generated_docx_filename,
      download_token, raw_data_json, ip_address, submitted_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const info = stmt.run(
    data.refNumber,
    data.fullName,
    data.positionApplied,
    data.rankLowerAcceptable || 'NO',
    data.dateAvailability || '',
    data.email,
    data.phone,
    data.indosNumber || '',
    data.cdcNumber || '',
    data.passportNumber || '',
    data.nationality || 'Indian',
    data.dob || '',
    data.status || 'submitted',
    data.cvOriginalName || '',
    data.cvStoredPath || '',
    data.cvSizeKb || 0,
    data.generatedDocxPath || '',
    data.generatedDocxFilename || '',
    data.downloadToken || null,
    JSON.stringify(data.rawData || {}),
    data.ipAddress || '',
    now,
    now
  );

  return {
    id: Number(info.lastInsertRowid),
    refNumber: data.refNumber
  };
}

/**
 * Get application by reference number
 */
function getByRef(refNumber) {
  const stmt = db.prepare('SELECT * FROM seafarer_applications WHERE ref_number = ?');
  const row = stmt.get(refNumber);
  if (!row) return null;
  return formatRow(row);
}

/**
 * Get application by ID
 */
function getById(id) {
  const stmt = db.prepare('SELECT * FROM seafarer_applications WHERE id = ?');
  const row = stmt.get(Number(id));
  if (!row) return null;
  return formatRow(row);
}

/**
 * Get application by private download token
 */
function getByDownloadToken(token) {
  if (!token) return null;
  const stmt = db.prepare('SELECT * FROM seafarer_applications WHERE download_token = ?');
  const row = stmt.get(token);
  if (!row) return null;
  return formatRow(row);
}

/**
 * Update generated DOCX paths
 */
function updateDocumentPaths(id, docxPath, docxFilename) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE seafarer_applications
    SET generated_docx_path = ?, generated_docx_filename = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(docxPath, docxFilename, now, Number(id));
}

/**
 * Update status
 */
function updateStatus(id, status) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE seafarer_applications
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, now, Number(id));
}

/**
 * List all applications with optional search and pagination
 */
function listApplications({ search = '', rank = '', status = '', limit = 50, offset = 0 } = {}) {
  let query = 'SELECT id, ref_number, full_name, position_applied, rank_lower_acceptable, date_availability, email, phone, indos_number, cdc_number, passport_number, status, cv_original_name, cv_size_kb, generated_docx_filename, download_token, submitted_at FROM seafarer_applications WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (ref_number LIKE ? OR full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR indos_number LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  if (rank) {
    query += ' AND position_applied = ?';
    params.push(rank);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  // Count total matching
  let countQuery = 'SELECT COUNT(*) as total FROM seafarer_applications WHERE 1=1';
  const countParams = [];
  if (search) {
    countQuery += ' AND (ref_number LIKE ? OR full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR indos_number LIKE ?)';
    const s = `%${search}%`;
    countParams.push(s, s, s, s, s);
  }
  if (rank) {
    countQuery += ' AND position_applied = ?';
    countParams.push(rank);
  }
  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }

  const countStmt = db.prepare(countQuery);
  const countRes = countStmt.get(...countParams);

  return {
    total: countRes ? Number(countRes.total) : rows.length,
    items: rows.map(r => ({
      id: Number(r.id),
      refNumber: r.ref_number,
      fullName: r.full_name,
      positionApplied: r.position_applied,
      rankLowerAcceptable: r.rank_lower_acceptable,
      dateAvailability: r.date_availability,
      email: r.email,
      phone: r.phone,
      indosNumber: r.indos_number,
      cdcNumber: r.cdc_number,
      passportNumber: r.passport_number,
      status: r.status,
      cvOriginalName: r.cv_original_name,
      cvSizeKb: r.cv_size_kb,
      hasDocx: Boolean(r.generated_docx_filename),
      downloadToken: r.download_token,
      submittedAt: r.submitted_at
    }))
  };
}

function formatRow(r) {
  let rawData = {};
  try {
    rawData = JSON.parse(r.raw_data_json || '{}');
  } catch (e) {
    rawData = {};
  }

  return {
    id: Number(r.id),
    refNumber: r.ref_number,
    fullName: r.full_name,
    positionApplied: r.position_applied,
    rankLowerAcceptable: r.rank_lower_acceptable,
    dateAvailability: r.date_availability,
    email: r.email,
    phone: r.phone,
    indosNumber: r.indos_number,
    cdcNumber: r.cdc_number,
    passportNumber: r.passport_number,
    nationality: r.nationality,
    dob: r.dob,
    status: r.status,
    cvOriginalName: r.cv_original_name,
    cvStoredPath: r.cv_stored_path,
    cvSizeKb: r.cv_size_kb,
    generatedDocxPath: r.generated_docx_path,
    generatedDocxFilename: r.generated_docx_filename,
    downloadToken: r.download_token,
    rawData,
    ipAddress: r.ip_address,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at
  };
}

module.exports = {
  createApplication,
  getByRef,
  getById,
  getByDownloadToken,
  updateDocumentPaths,
  updateStatus,
  listApplications
};
