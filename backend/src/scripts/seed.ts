/**
 * One-time data migration: imports GENERAL_REGISTRY_FILES.xlsx and
 * PERSONEL_REGISTRY_FILES_1_.xlsx (already converted to JSON — see
 * ../../../MIGRATION_NOTES.md) into MySQL.
 *
 * Usage:  npm run seed
 * Requires: schema already created (sql/01_schema.sql) and .env configured.
 *
 * Every staff account is created with password = their ID number
 * (falling back to file number if no ID is on record), hashed with
 * bcrypt, and flagged must_change_password so they're prompted to set
 * their own password on first login.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../config/db';

dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const personnel = require('./data/personnel.json') as Array<{
  file_number: string;
  name: string;
  designation: string;
  id_number: string | null;
}>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const generalFiles = require('./data/general_files.json') as Array<{
  file_name: string;
  file_number: string;
}>;

const ADMIN_USERS = [
  { file_number: 'ADMIN001', name: 'AMOS KIHARA', designation: 'REGISTRY ADMINISTRATOR', id_number: '36929017' },
  { file_number: '20210525517', name: 'ALEX KARIITHI', designation: 'Registry Officer', id_number: '28864134' },
  { file_number: '20210525525', name: 'EDITA WAIRIMU', designation: 'Registry Officer', id_number: '33334098' },
];

const SPECIAL_USERS = [
  { file_number: 'COUNTY-ATTORNEY', name: 'COUNTY ATTORNEY', designation: 'County Attorney', id_number: null },
  { file_number: 'CPSB', name: 'COUNTY PUBLIC SERVICE BOARD (CPSB)', designation: 'CPSB', id_number: null },
];

const BCRYPT_COST = 10; // seed uses 10 for reasonable runtime over ~2,900 rows; interactive signups use 12

async function upsertUser(
  conn: any,
  row: { file_number: string; name: string; designation: string; id_number: string | null },
  role: 'admin' | 'user' | 'special'
): Promise<number> {
  const defaultPassword = row.id_number || row.file_number;
  const passwordHash = await bcrypt.hash(String(defaultPassword), BCRYPT_COST);

  await conn.query(
    `INSERT INTO users (file_number, name, designation, id_number, role, password_hash, must_change_password, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), designation = VALUES(designation)`,
    [row.file_number, row.name, row.designation || '', row.id_number, role, passwordHash]
  );
  const [rows] = await conn.query('SELECT id FROM users WHERE file_number = ?', [row.file_number]);
  return rows[0].id as number;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log(`Seeding ${ADMIN_USERS.length} admin, ${SPECIAL_USERS.length} special, and ${personnel.length} personnel accounts...`);

    for (const a of ADMIN_USERS) {
      await upsertUser(conn, a, 'admin');
    }
    for (const s of SPECIAL_USERS) {
      await upsertUser(conn, s, 'special');
    }

    let count = 0;
    for (const p of personnel) {
      const userId = await upsertUser(conn, p, 'user');

      // Every staff member automatically gets a personal file in the registry.
      const fileId = `PERS_${p.file_number}`;
      await conn.query(
        `INSERT INTO registry_files (file_id, file_name, file_number, category, owner_user_id)
         VALUES (?, ?, ?, 'personal', ?)
         ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), owner_user_id = VALUES(owner_user_id)`,
        [fileId, p.name, p.file_number, userId]
      );

      count++;
      if (count % 500 === 0) console.log(`  ...${count}/${personnel.length} personnel imported`);
    }

    console.log(`Seeding ${generalFiles.length} general registry files...`);
    for (const g of generalFiles) {
      const fileId = `GEN_${g.file_number}`;
      await conn.query(
        `INSERT INTO registry_files (file_id, file_name, file_number, category)
         VALUES (?, ?, ?, 'general')
         ON DUPLICATE KEY UPDATE file_name = VALUES(file_name)`,
        [fileId, g.file_name, g.file_number]
      );
    }

    console.log('Seed complete.');
    console.log('Default login password for every imported account = their ID number (or file number if none on record).');
    console.log('Every account is flagged must_change_password = 1.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
