const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool (more efficient than single connections)
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || 'daisy15',
  database:           process.env.DB_NAME     || 'disaster_resource_mgmt',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // Return JS Date objects for TIMESTAMP columns
  dateStrings:        false,
});

// Test the connection on startup
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    connection.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1); // Exit if DB is unreachable
  }
};

module.exports = { pool, testConnection };
