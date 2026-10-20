/**
 * seedAdmin.js
 * ─────────────────────────────────────────────────────────────────────
 * Creates the initial admin account for the Disaster Resource Mgmt system.
 * Run once: npm run seed:admin
 *
 * IMPORTANT: Change the credentials below before running!
 * ─────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, testConnection } = require('../config/db');

const ADMIN = {
  name:     'Pooja (Admin)',
  email:    'pooja57venkatesh@gmail.com',
  password: 'admin#123',
  phone:    null,
  role:     'admin',
};

const seed = async () => {
  await testConnection();

  try {
    // Check if admin already exists
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?',
      [ADMIN.email.toLowerCase()]
    );

    if (existing.length > 0) {
      console.log(`⚠️  Admin with email "${ADMIN.email}" already exists. Skipping.`);
      process.exit(0);
    }

    const saltRounds    = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(ADMIN.password, saltRounds);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
      [ADMIN.name, ADMIN.email.toLowerCase(), password_hash, ADMIN.phone, ADMIN.role]
    );

    console.log('✅  Admin account created successfully!');
    console.log(`    Email    : ${ADMIN.email}`);
    console.log(`    Password : ${ADMIN.password}`);
    console.log(`    user_id  : ${result.insertId}`);
    console.log('\n🔒  IMPORTANT: Change the password after first login!');

    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
