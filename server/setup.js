const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('Database biomedical_equipment is ready.');
  } finally {
    await connection.end();
  }
}

function describeError(error) {
  if (error && Array.isArray(error.errors) && error.errors.length) {
    const details = error.errors.map((item) => item.message).filter(Boolean);
    if (details.length) return details.join('; ');
  }
  return error.message || error.code || String(error);
}

setup().catch((error) => {
  console.error('Database setup failed:', describeError(error));
  process.exit(1);
});
