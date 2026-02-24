import sqlite3   from 'sqlite3';
import { open, Database } from 'sqlite';

/**
 * Opens a fresh in-memory SQLite database with the full schema.
 * Each test that calls this gets an isolated DB — no shared state.
 */
export async function createTestDb(): Promise<Database> {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });

  await db.run('PRAGMA foreign_keys = ON');

  await db.run(`
    CREATE TABLE departments (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    )
  `);

  await db.run(`
    CREATE TABLE employees (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL,
      department_id INTEGER REFERENCES departments(id),
      employee_type TEXT    NOT NULL DEFAULT 'permanent',
      surname       TEXT,
      first_name    TEXT,
      middle_name   TEXT,
      birthday      TEXT
    )
  `);

  await db.run(`
    CREATE TABLE punch_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT    NOT NULL REFERENCES employees(id),
      punched_at  TEXT    NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      filtered    INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.run(`
    CREATE TABLE dtr_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT    NOT NULL REFERENCES employees(id),
      date        TEXT    NOT NULL,
      am_in       TEXT,
      am_out      TEXT,
      pm_in       TEXT,
      pm_out      TEXT
    )
  `);

  return db;
}

/** Seed a single employee (and optional department) for use in tests */
export async function seedEmployee(
  db: Database,
  opts: {
    id:            string;
    name:          string;
    employee_type?: string;
    department?:   string;
  },
): Promise<void> {
  let department_id: number | null = null;

  if (opts.department) {
    await db.run(`INSERT INTO departments (name) VALUES (?)`, [opts.department]);
    const row = await db.get<{ id: number }>(`SELECT id FROM departments WHERE name = ?`, [opts.department]);
    department_id = row?.id ?? null;
  }

  await db.run(
    `INSERT INTO employees (id, name, department_id, employee_type) VALUES (?, ?, ?, ?)`,
    [opts.id, opts.name, department_id, opts.employee_type ?? 'permanent'],
  );
}