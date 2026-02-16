import { parse } from 'csv-parse/sync';
const db_module = require('../../database/db');
const getDb = db_module.getDb ?? db_module.default?.getDb;

// ─── Types ────────────────────────────────────────────────────

export interface ParseResult {
  inserted:  number;
  skipped:   number;
  employees: number;
}

// ─── Constants ────────────────────────────────────────────────
const DEDUP_WINDOW_MINUTES = 5;

// ─── Helpers ─────────────────────────────────────────────────

function diffMinutes(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}

// Normalize a raw CSV row into { employeeId, name, punchedAt }
// Format A (new): employee_id, name, timestamp  ← dummy_punches_v2.csv
// Format B (old): employeeId,  name, date, time ← legacy device export
function normalizeRow(row: any): { employeeId: string; name: string; punchedAt: string } | null {
  // Format A — single timestamp column
  if (row.timestamp) {
    const employeeId = (row.employee_id ?? row.employeeId ?? '').trim();
    const name       = (row.name ?? '').trim();
    const punchedAt  = row.timestamp.trim();
    if (!employeeId || !name || !punchedAt) return null;
    return { employeeId, name, punchedAt };
  }

  // Format B — separate date + time columns
  if (row.date && row.time) {
    const employeeId = (row.employee_id ?? row.employeeId ?? '').trim();
    const name       = (row.name ?? '').trim();
    const punchedAt  = `${row.date.trim()}T${row.time.trim()}`;
    if (!employeeId || !name) return null;
    return { employeeId, name, punchedAt };
  }

  return null;
}

// ─── Main service function ────────────────────────────────────

export async function processCsv(fileBuffer: Buffer): Promise<ParseResult> {
  const db = getDb();

  const rawRows: any[] = parse(fileBuffer, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
  });

  if (!rawRows.length) throw new Error('CSV file is empty or has no valid rows.');

  // Normalize rows — filter out any that can't be parsed
  const normalized = rawRows
    .map(normalizeRow)
    .filter(Boolean) as { employeeId: string; name: string; punchedAt: string }[];

  if (!normalized.length) throw new Error('No valid rows found. Check CSV column names.');

  // Upsert employees
  const uniqueEmployees = new Map<string, string>();
  for (const row of normalized) {
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

  // Sort by employee + time for correct dedup ordering
  const sorted = [...normalized].sort((a, b) =>
    a.employeeId.localeCompare(b.employeeId) || a.punchedAt.localeCompare(b.punchedAt)
  );

  let inserted = 0;
  let skipped  = 0;
  const lastPunch = new Map<string, string>();

  for (const row of sorted) {
    const last = lastPunch.get(row.employeeId);

    // Skip if within dedup window
    if (last && diffMinutes(last, row.punchedAt) < DEDUP_WINDOW_MINUTES) {
      skipped++;
      continue;
    }

    await db.run(
      `INSERT INTO punch_logs (employee_id, punched_at, used, filtered)
       VALUES (?, ?, 0, 0)`,
      [row.employeeId, row.punchedAt]
    );

    lastPunch.set(row.employeeId, row.punchedAt);
    inserted++;
  }

  return { inserted, skipped, employees: uniqueEmployees.size };
}