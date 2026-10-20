/**
 * migrate_email_auth.js
 * ─────────────────────────────────────────────────────────────────────
 * Adds the database objects needed for email verification (OTP) and
 * forgot-password / reset-password:
 *
 *   users.email_verified        TINYINT(1) NOT NULL DEFAULT 1
 *   users.email_verified_at     DATETIME NULL
 *   email_verification_otps     (one row per user: hashed OTP, expiry, attempts, cooldown)
 *   password_reset_tokens       (hashed single-use reset tokens)
 *
 * Safe to run multiple times. It NEVER deletes or rewrites existing data:
 *   • Every existing user (including admins) keeps working: the new
 *     email_verified column defaults to 1, so all current rows are treated
 *     as verified. Only accounts created through the new public
 *     registration flow are inserted with email_verified = 0.
 *   • The FK column type is read from users.user_id so it matches your
 *     live schema (INT / BIGINT / UNSIGNED).
 *
 * Usage:   npm run migrate:email-auth     (or: node migrate_email_auth.js)
 * ─────────────────────────────────────────────────────────────────────
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'disaster_resource_mgmt';

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [DB_NAME, table]
  );
  return rows.length > 0;
}

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
  });

  console.log(`Running email-auth migration on database "${DB_NAME}"...`);

  try {
    if (!(await tableExists(conn, 'users'))) {
      throw new Error('Table "users" not found. Point DB_NAME at your existing database.');
    }

    // ── 1. users.email_verified / email_verified_at ───────────────────
    if (!(await columnExists(conn, 'users', 'email_verified'))) {
      // DEFAULT 1 => every pre-existing account (incl. admin) stays verified.
      await conn.query(
        `ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1`
      );
      console.log('  + users.email_verified (existing accounts marked verified)');
    } else {
      console.log('  ~ users.email_verified already exists');
    }

    if (!(await columnExists(conn, 'users', 'email_verified_at'))) {
      await conn.query(`ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL DEFAULT NULL`);
      console.log('  + users.email_verified_at');
    } else {
      console.log('  ~ users.email_verified_at already exists');
    }

    // ── 2. Match the live users.user_id type for foreign keys ────────
    const [[idCol]] = await conn.query(
      `SELECT COLUMN_TYPE AS t FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id'`,
      [DB_NAME]
    );
    if (!idCol) throw new Error('users.user_id column not found.');
    const userIdType = idCol.t; // e.g. "int", "int unsigned", "bigint"

    // ── 3. email_verification_otps ────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS email_verification_otps (
        id                      BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id                 ${userIdType} NOT NULL,
        otp_hash                CHAR(64)     NOT NULL,
        expires_at              DATETIME     NOT NULL,
        attempts                INT          NOT NULL DEFAULT 0,
        consumed_at             DATETIME     NULL DEFAULT NULL,
        last_sent_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        send_count              INT          NOT NULL DEFAULT 1,
        send_window_started_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_evo_user (user_id),
        CONSTRAINT fk_evo_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('  ~ email_verification_otps ready');

    // ── 4. password_reset_tokens ──────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id     ${userIdType} NOT NULL,
        token_hash  CHAR(64)     NOT NULL,
        expires_at  DATETIME     NOT NULL,
        used_at     DATETIME     NULL DEFAULT NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_prt_hash (token_hash),
        KEY idx_prt_user (user_id),
        CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('  ~ password_reset_tokens ready');

    const [[counts]] = await conn.query(
      `SELECT COUNT(*) AS total, SUM(email_verified = 1) AS verified FROM users`
    );
    console.log(`\nMigration complete. users: ${counts.total} total, ${counts.verified} verified.`);
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
