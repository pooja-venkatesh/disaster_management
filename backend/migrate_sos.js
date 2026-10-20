/**
 * migrate_sos.js
 * Adds new SOS fields to emergency_requests table.
 * Safe to run multiple times (uses IF NOT EXISTS checks).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'disaster_resource_mgmt',
  });

  console.log('Running SOS schema migration...');

  const alterations = [
    { col: 'people_count',     sql: 'ADD COLUMN people_count     INT          NOT NULL DEFAULT 1 AFTER description' },
    { col: 'needs',            sql: "ADD COLUMN needs             VARCHAR(200) NOT NULL DEFAULT '' AFTER people_count" },
    { col: 'children_present', sql: 'ADD COLUMN children_present  BOOLEAN      NOT NULL DEFAULT FALSE AFTER needs' },
    { col: 'elderly_present',  sql: 'ADD COLUMN elderly_present   BOOLEAN      NOT NULL DEFAULT FALSE AFTER children_present' },
    { col: 'injured',          sql: 'ADD COLUMN injured            BOOLEAN      NOT NULL DEFAULT FALSE AFTER elderly_present' },
    { col: 'urgent_medical',   sql: 'ADD COLUMN urgent_medical     BOOLEAN      NOT NULL DEFAULT FALSE AFTER injured' },
    { col: 'priority_score',   sql: 'ADD COLUMN priority_score     INT          DEFAULT NULL AFTER urgent_medical' },
  ];

  for (const alt of alterations) {
    // Check if column already exists
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'emergency_requests' AND COLUMN_NAME = ?`,
      [process.env.DB_NAME || 'disaster_resource_mgmt', alt.col]
    );
    if (rows.length === 0) {
      await conn.query(`ALTER TABLE emergency_requests ${alt.sql}`);
      console.log(`  + Added column: ${alt.col}`);
    } else {
      console.log(`  ~ Already exists: ${alt.col}`);
    }
  }

  // Update priority ENUM to ensure all 4 levels exist (it may already have them)
  await conn.query(`
    ALTER TABLE emergency_requests
    MODIFY COLUMN priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low'
  `);
  console.log('  ~ priority ENUM verified');

  console.log('\nMigration complete.');
  await conn.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
