/**
 * Sonic Scribe v2 — History Service
 * SQLite-based transcription history with opt-out
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/history.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    filename TEXT,
    duration TEXT,
    duration_seconds INTEGER,
    transcription TEXT,
    analysis TEXT,
    engine TEXT,
    whisper_model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS notion_databases (
    id TEXT PRIMARY KEY,
    name TEXT,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- Transcription CRUD ---

function saveTranscription(data) {
  const stmt = db.prepare(`
    INSERT INTO transcriptions (title, type, filename, duration, duration_seconds, transcription, analysis, engine, whisper_model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.title || 'Untitled',
    data.type || 'Unknown',
    data.filename || '',
    data.duration || '',
    data.duration_seconds || 0,
    data.transcription || '',
    JSON.stringify(data.analysis || {}),
    data.engine || '',
    data.whisper_model || ''
  );
  return result.lastInsertRowid;
}

function getTranscription(id) {
  const row = db.prepare('SELECT * FROM transcriptions WHERE id = ?').get(id);
  if (row && row.analysis) {
    try { row.analysis = JSON.parse(row.analysis); } catch { /* keep as string */ }
  }
  return row;
}

function listTranscriptions(limit = 50, offset = 0) {
  const rows = db.prepare(
    'SELECT id, title, type, filename, duration, engine, whisper_model, created_at FROM transcriptions ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  return rows;
}

function deleteTranscription(id) {
  return db.prepare('DELETE FROM transcriptions WHERE id = ?').run(id);
}

function getTranscriptionCount() {
  return db.prepare('SELECT COUNT(*) as count FROM transcriptions').get().count;
}

// --- Settings ---

function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

// --- Notion Databases ---

function saveNotionDatabase(id, name) {
  db.prepare('INSERT OR REPLACE INTO notion_databases (id, name, last_used) VALUES (?, ?, CURRENT_TIMESTAMP)').run(id, name);
}

function getNotionDatabases() {
  return db.prepare('SELECT * FROM notion_databases ORDER BY last_used DESC').all();
}

function deleteNotionDatabase(id) {
  return db.prepare('DELETE FROM notion_databases WHERE id = ?').run(id);
}

module.exports = {
  saveTranscription, getTranscription, listTranscriptions, deleteTranscription, getTranscriptionCount,
  getSetting, setSetting, getAllSettings,
  saveNotionDatabase, getNotionDatabases, deleteNotionDatabase,
};
