require('dotenv').config();
const mysql = require('mysql2/promise');

async function runSQL() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'disaster_resource_mgmt',
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS shelter_inventory (
      inventory_id  INT           PRIMARY KEY AUTO_INCREMENT,
      shelter_id    INT           NOT NULL,
      item_type     ENUM('food','water','medicine','clothing','other') NOT NULL,
      quantity      INT           NOT NULL DEFAULT 0,
      unit          VARCHAR(30)   DEFAULT 'units',
      last_updated  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_shelter_item (shelter_id, item_type),
      FOREIGN KEY (shelter_id) REFERENCES shelter_profiles(shelter_id) ON DELETE CASCADE
    );
  `);

  console.log('shelter_inventory table created successfully.');
  await conn.end();
}

runSQL().catch(console.error);
