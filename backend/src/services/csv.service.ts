import { parse } from 'csv-parse/sync';
const db_module = require('../../database/db');
const getDb = db_module.getDb ?? db_module.default?.getDb;

// ─── Types ────────────────────────────────────────────────────

export interface RawPunch {
  employeeId: string;
  name:       string;
  date:       string; // YYYY-MM-DD
  time:       string; // HH:MM:SS
}

export interface ParseResult {
  inserted: number;
  skipped:  number;
  employees: number;
}

// ─── Constants ────────────────────────────────────────────────

// Punches from the same employee within this window = duplicate tap
const DEDUP_WINDOW_MINUTES = 5;

// ─── Helpers ─────────────────────────────────────────────────

function toIso(date: string, time: string): string {
  return `${date}T${time}`;
}

function diffMinutes(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}

// ─── Main service function ────────────────────────────────────

export async function processCsv(fileBuffer: Buffer): Promise<ParseResult> {
  const db = getDb();

  // 1. Parse CSV buffer into rows
  const rows: RawPunch[] = parse(fileBuffer, {
    columns:          true,   // use first row as keys
    skip_empty_lines: true,
    trim:             true,
  });

  if (!rows.length) throw new Error('CSV file is empty or has no valid rows.');

  // 2. Upsert employees — insert if not exists, update name if changed
  const uniqueEmployees = new Map<string, string>();
  for (const row of rows) {
    if (!row.employeeId || !row.name) continue;
    uniqueEmployees.set(row.employeeId, row.name);
  }

  for (const [id, name] of uniqueEmployees) {
    await db.run(
      `INSERT INTO employees (id, name)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      [id, name]
    );
  }

  // 3. Insert raw punches — deduplicate within DEDUP_WINDOW_MINUTES per employee
  let inserted = 0;
  let skipped  = 0;

  // Track the last punch time per employee for dedup check
  const lastPunch = new Map<string, string>();

  // Sort rows by employeeId + datetime so dedup works correctly
  const sorted = [...rows].sort((a, b) => {
    const dtA = toIso(a.date, a.time);
    const dtB = toIso(b.date, b.time);
    return a.employeeId.localeCompare(b.employeeId) || dtA.localeCompare(dtB);
  });

  for (const row of sorted) {
    if (!row.employeeId || !row.date || !row.time) {
      skipped++;
      continue;
    }

    const punchedAt = toIso(row.date, row.time);
    const last      = lastPunch.get(row.employeeId);

    // Skip if within dedup window
    if (last && diffMinutes(last, punchedAt) < DEDUP_WINDOW_MINUTES) {
      skipped++;
      continue;
    }

    // Insert raw punch — used = 0 (not yet processed into DTR)
    await db.run(
      `INSERT INTO punch_logs (employee_id, punched_at, used)
       VALUES (?, ?, 0)`,
      [row.employeeId, punchedAt]
    );

    lastPunch.set(row.employeeId, punchedAt);
    inserted++;
  }

  return {
    inserted,
    skipped,
    employees: uniqueEmployees.size,
  };
}