import { describe, it, expect } from 'vitest';
import { dedupPunches, assignColumns, buildDtrRecords } from '../services/dtr.service';

// ─── Helpers ──────────────────────────────────────────────────

function punch(id: number, employee_id: string, punched_at: string) {
  return { id, employee_id, punched_at };
}

// ─── dedupPunches ─────────────────────────────────────────────

describe('dedupPunches', () => {
  it('keeps punches more than 5 minutes apart', () => {
    const punches = [
      punch(1, 'E001', '2026-01-02T08:00:00'),
      punch(2, 'E001', '2026-01-02T08:06:00'), // 6 min later → keep
    ];
    const { kept, filtered } = dedupPunches(punches);
    expect(kept).toHaveLength(2);
    expect(filtered).toHaveLength(0);
  });

  it('filters punches within 5 minutes of previous', () => {
    const punches = [
      punch(1, 'E001', '2026-01-02T08:00:00'),
      punch(2, 'E001', '2026-01-02T08:03:00'), // 3 min later → filter
      punch(3, 'E001', '2026-01-02T08:07:00'), // 4 min after #2 but 7 min after #1 → keep
    ];
    const { kept, filtered } = dedupPunches(punches);
    expect(kept).toHaveLength(2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it('handles empty input', () => {
    const { kept, filtered } = dedupPunches([]);
    expect(kept).toHaveLength(0);
    expect(filtered).toHaveLength(0);
  });
});

// ─── assignColumns ────────────────────────────────────────────

describe('assignColumns', () => {
  const make = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      punch(i + 1, 'E001', `2026-01-02T0${8 + i}:00:00`),
    );

  it('assigns 1 punch to am_in only', () => {
    const result = assignColumns(make(1));
    expect(result.am_in).toBeTruthy();
    expect(result.am_out).toBeNull();
    expect(result.pm_in).toBeNull();
    expect(result.pm_out).toBeNull();
  });

  it('assigns 2 punches to am_in + pm_out', () => {
    const result = assignColumns(make(2));
    expect(result.am_in).toBeTruthy();
    expect(result.am_out).toBeNull();
    expect(result.pm_in).toBeNull();
    expect(result.pm_out).toBeTruthy();
  });

  it('assigns 4 punches to all four columns', () => {
    const punches = make(4);
    const result  = assignColumns(punches);
    expect(result.am_in).toBe(punches[0].punched_at);
    expect(result.am_out).toBe(punches[1].punched_at);
    expect(result.pm_in).toBe(punches[2].punched_at);
    expect(result.pm_out).toBe(punches[3].punched_at);
  });

  it('for 5+ punches uses first, second, second-to-last, last', () => {
    const punches = make(6);
    const result  = assignColumns(punches);
    expect(result.am_in).toBe(punches[0].punched_at);
    expect(result.am_out).toBe(punches[1].punched_at);
    expect(result.pm_in).toBe(punches[4].punched_at);
    expect(result.pm_out).toBe(punches[5].punched_at);
  });

  it('returns all null for 0 punches', () => {
    const result = assignColumns([]);
    expect(result).toEqual({ am_in: null, am_out: null, pm_in: null, pm_out: null });
  });
});

// ─── buildDtrRecords ──────────────────────────────────────────

describe('buildDtrRecords', () => {
  it('groups punches by date', () => {
    const punches = [
      punch(1, 'E001', '2026-01-02T08:00:00'),
      punch(2, 'E001', '2026-01-02T17:00:00'),
      punch(3, 'E001', '2026-01-03T08:00:00'),
      punch(4, 'E001', '2026-01-03T17:00:00'),
    ];
    const records = buildDtrRecords(punches);
    expect(records).toHaveLength(2);
    expect(records[0].date).toBe('2026-01-02');
    expect(records[1].date).toBe('2026-01-03');
  });

  it('returns empty array for no punches', () => {
    expect(buildDtrRecords([])).toHaveLength(0);
  });

  it('does not create duplicate dates', () => {
    const punches = [
      punch(1, 'E001', '2026-01-02T08:00:00'),
      punch(2, 'E001', '2026-01-02T12:00:00'),
      punch(3, 'E001', '2026-01-02T13:00:00'),
      punch(4, 'E001', '2026-01-02T17:00:00'),
    ];
    const records = buildDtrRecords(punches);
    expect(records).toHaveLength(1);
  });
});
