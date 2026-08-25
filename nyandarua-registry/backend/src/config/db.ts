import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// mysql2's pool with placeholders (?) always sends parameters separately
// from the SQL text — this is what protects every query in this app
// from SQL injection. Never use string concatenation / template
// literals to build SQL with user input anywhere in this codebase.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  namedPlaceholders: false,
  decimalNumbers: true,
});

export async function pingDb(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}
