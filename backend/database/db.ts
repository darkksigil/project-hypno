import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database;

const dbPath = path.resolve(process.cwd(), 'database', 'mydb.sqlite');

async function initDb(): Promise<void> {
  // Corruption check
  if (fs.existsSync(dbPath)) {
    try {
      const tempDb = await open({ filename: dbPath, driver: sqlite3.Database });
      await tempDb.get('SELECT 1');
      await tempDb.close();
    } catch (err) {
      console.error('❌ DB corrupted, recreating...', err);
      fs.unlinkSync(dbPath);
    }
  }

  dbInstance = await open({ filename: dbPath, driver: sqlite3.Database });

  await dbInstance.run('PRAGMA foreign_keys = ON');

  // ─── Schema ───────────────────────────────────────────────

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    )
  `);

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      employee_type TEXT    NOT NULL DEFAULT 'permanent'
    )
  `);

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS punch_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT    NOT NULL REFERENCES employees(id),
      punched_at  TEXT    NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS dtr_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT    NOT NULL REFERENCES employees(id),
      date        TEXT    NOT NULL,
      time_in     TEXT,
      time_out    TEXT,
      total_hours REAL
    )
  `);

  // ─── Migrations (safe — only adds columns if missing) ─────
  const empCols: { name: string }[] = await dbInstance.all(`PRAGMA table_info(employees)`);
  const empColNames = empCols.map((c: { name: string }) => c.name);

  if (!empColNames.includes('department_id')) {
    await dbInstance.run(`ALTER TABLE employees ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
    console.log('✅ Migration: added department_id to employees');
  }

  if (!empColNames.includes('employee_type')) {
    await dbInstance.run(`ALTER TABLE employees ADD COLUMN employee_type TEXT NOT NULL DEFAULT 'permanent'`);
    console.log('✅ Migration: added employee_type to employees');
  }

  console.log('✅ Database initialized at', dbPath);
}

function getDb(): Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}

module.exports = { initDb, getDb };