require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, testConnection } = require('./src/config/db');

const ADMIN = {
  name:     'Pooja (Admin)',
  email:    'pooja57venkatesh@gmail.com',
  password: 'admin#123',
  role:     'admin',
};

async function resetAndSeed() {
  await testConnection();

  // Remove any existing admin
  await pool.query("DELETE FROM users WHERE role = 'admin'");
  console.log('Old admin(s) removed.');

  // Create new admin
  const saltRounds    = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const password_hash = await bcrypt.hash(ADMIN.password, saltRounds);

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
    [ADMIN.name, ADMIN.email.toLowerCase(), password_hash, null, ADMIN.role]
  );

  console.log('\n✅  Admin created successfully!');
  console.log('    Email    :', ADMIN.email);
  console.log('    Password :', ADMIN.password);
  console.log('    user_id  :', result.insertId);

  await pool.end();
  process.exit(0);
}

resetAndSeed().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
