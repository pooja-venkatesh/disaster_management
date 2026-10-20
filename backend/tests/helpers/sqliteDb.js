/**
 * sqliteDb.js  — TEST-ONLY stand-in for ../../src/config/db
 *
 * Exposes the same { pool } surface the app uses (query / getConnection /
 * beginTransaction / commit / rollback) on top of Node's built-in node:sqlite,
 * translating the handful of MySQL constructs used by the email-auth code:
 *   NOW(), DATE_ADD/DATE_SUB(NOW(), INTERVAL ? MINUTE|SECOND),
 *   TIMESTAMPDIFF(SECOND, col, NOW()), FOR UPDATE.
 *
 * This is NOT MySQL: it cannot validate MySQL DDL, row locking or collation.
 */
const { DatabaseSync } = require('node:sqlite');

const translate = (sql) => sql
  .replace(/\s+FOR UPDATE/gi, '')
  .replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s*\?\s*(MINUTE|SECOND)\)/gi,
    (_, u) => `datetime('now', '+' || ? || ' ${u.toLowerCase()}s')`)
  .replace(/DATE_SUB\(NOW\(\),\s*INTERVAL\s*\?\s*(MINUTE|SECOND)\)/gi,
    (_, u) => `datetime('now', '-' || ? || ' ${u.toLowerCase()}s')`)
  .replace(/TIMESTAMPDIFF\(SECOND,\s*([\w.]+),\s*NOW\(\)\)/gi,
    (_, col) => `CAST(strftime('%s','now') - strftime('%s', ${col}) AS INTEGER)`)
  .replace(/NOW\(\)/gi, `datetime('now')`);

const bind = (params = []) => params.map((p) =>
  p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p);

const SCHEMA = `
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  phone TEXT, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_verified INTEGER NOT NULL DEFAULT 1, email_verified_at TEXT
);
CREATE TABLE email_verification_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT, last_sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  send_count INTEGER NOT NULL DEFAULT 1,
  send_window_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

const createDb = () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  raw.exec(SCHEMA);

  const run = async (sql, params) => {
    const t = translate(sql);
    try {
      const stmt = raw.prepare(t);
      if (/^\s*SELECT/i.test(t)) return [stmt.all(...bind(params))];
      const r = stmt.run(...bind(params));
      return [{ affectedRows: Number(r.changes), insertId: Number(r.lastInsertRowid) }];
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(err.message)) err.code = 'ER_DUP_ENTRY';
      throw err;
    }
  };

  const conn = {
    query: run,
    beginTransaction: async () => { raw.exec('BEGIN'); },
    commit:           async () => { raw.exec('COMMIT'); },
    rollback:         async () => { try { raw.exec('ROLLBACK'); } catch { /* none active */ } },
    release:          () => {},
  };
  const pool = { query: run, getConnection: async () => conn };
  return { raw, pool, testConnection: async () => {} };
};

module.exports = { createDb };
