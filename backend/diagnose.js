require('dotenv').config();
const mysql = require('mysql2/promise');

async function diagnose() {
  console.log('\n=== ENV CHECK ===');
  console.log('DB_HOST    :', process.env.DB_HOST);
  console.log('DB_USER    :', process.env.DB_USER);
  console.log('DB_NAME    :', process.env.DB_NAME);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '(set)' : '(MISSING!)');
  console.log('JWT_SECRET :', process.env.JWT_SECRET  ? '(set)' : '(MISSING!)');

  try {
    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'disaster_resource_mgmt',
    });

    console.log('\n=== DB CONNECTION ===');
    console.log('Connected OK');

    // Check tables
    const [tables] = await conn.query('SHOW TABLES');
    console.log('\n=== TABLES ===');
    tables.forEach(t => console.log(' -', Object.values(t)[0]));

    // Check admin users
    const [admins] = await conn.query(
      'SELECT user_id, name, email, role, is_active FROM users WHERE role = "admin"'
    );
    console.log('\n=== ADMIN USERS ===');
    if (admins.length === 0) {
      console.log('NO ADMIN FOUND — run: npm run seed:admin');
    } else {
      admins.forEach(a => console.log(' -', JSON.stringify(a)));
    }

    await conn.end();
  } catch (err) {
    console.error('\n=== DB ERROR ===');
    console.error(err.message);
  }
}

diagnose();
