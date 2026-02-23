import logger from '../src/utils/logger';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database;

const dbPath = path.resolve(process.cwd(), 'database', 'mydb.sqlite');

export async function initDb(): Promise<void> {
  if (fs.existsSync(dbPath)) {
    try {
      const tempDb = await open({ filename: dbPath, driver: sqlite3.Database });
      await tempDb.get('SELECT 1');
      await tempDb.close();
    } catch (err) {
      logger.error('❌ DB corrupted, recreating...', err);
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
      used        INTEGER NOT NULL DEFAULT 0,
      filtered    INTEGER NOT NULL DEFAULT 0
    )
  `);

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS dtr_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT    NOT NULL REFERENCES employees(id),
      date        TEXT    NOT NULL,
      am_in       TEXT,
      am_out      TEXT,
      pm_in       TEXT,
      pm_out      TEXT
    )
  `);

  // ─── Migrations ──────────────────────────────────────────

  const empCols: { name: string }[] = await dbInstance.all(`PRAGMA table_info(employees)`);
  const empColNames = empCols.map((c) => c.name);

  if (!empColNames.includes('department_id')) {
    await dbInstance.run(`ALTER TABLE employees ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
    logger.info('✅ Migration: added department_id to employees');
  }
  if (!empColNames.includes('employee_type')) {
    await dbInstance.run(`ALTER TABLE employees ADD COLUMN employee_type TEXT NOT NULL DEFAULT 'permanent'`);
    logger.info('✅ Migration: added employee_type to employees');
  }

  const punchCols: { name: string }[] = await dbInstance.all(`PRAGMA table_info(punch_logs)`);
  const punchColNames = punchCols.map((c) => c.name);
  if (!punchColNames.includes('filtered')) {
    await dbInstance.run(`ALTER TABLE punch_logs ADD COLUMN filtered INTEGER NOT NULL DEFAULT 0`);
    logger.info('✅ Migration: added filtered to punch_logs');
  }

  logger.info('✅ Database initialized at', dbPath);
}

export function getDb(): Database {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}