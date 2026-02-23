import { describe, it, expect } from 'vitest';
import { generateDtrHtml, type EmployeeDtrData } from '../services/print.service';

// ─── Fixtures ─────────────────────────────────────────────────

function makeEmployee(overrides: Partial<EmployeeDtrData> = {}): EmployeeDtrData {
  return {
    employee_id:   'E001',
    name:          'Juan dela Cruz',
    employee_type: 'permanent',
    department:    'Engineering',
    records:       [],
    ...overrides,
  };
}

// ─── generateDtrHtml ──────────────────────────────────────────

describe('generateDtrHtml', () => {
  it('includes the employee name in uppercase', () => {
    const html = generateDtrHtml(makeEmployee({ name: 'Juan dela Cruz' }), '2026-01-01', '2026-01-01');
    expect(html).toContain('JUAN DELA CRUZ');
  });

  it('includes the correct date range label', () => {
    const html = generateDtrHtml(makeEmployee(), '2026-01-01', '2026-01-15');
    expect(html).toContain('January 1, 2026');
    expect(html).toContain('January 15, 2026');
  });

  it('generates a row for every date in the range', () => {
    const html = generateDtrHtml(makeEmployee(), '2026-01-01', '2026-01-05');
    // Each day row has a cell with the day number + weekday label
    expect(html).toContain('1 Thu');
    expect(html).toContain('2 Fri');
    expect(html).toContain('5 Mon');
  });

  it('counts absences correctly when no records', () => {
    // 3-day range, no records → 3 absences
    const html = generateDtrHtml(makeEmployee(), '2026-01-01', '2026-01-03');
    expect(html).toContain('>3<'); // absentCount in the TOTAL row
  });

  it('counts zero absences when all days have records', () => {
    const employee = makeEmployee({
      records: [
        { date: '2026-01-01', am_in: '2026-01-01T08:00:00', am_out: null, pm_in: null, pm_out: '2026-01-01T17:00:00' },
      ],
    });
    const html = generateDtrHtml(employee, '2026-01-01', '2026-01-01');
    // absentCount should be 0 in the TOTAL row
    expect(html).toMatch(/<td class="td-total-absent">0<\/td>/);
  });

  it('formats time correctly as 12-hour AM/PM', () => {
    const employee = makeEmployee({
      records: [
        { date: '2026-01-01', am_in: '2026-01-01T08:05:00', am_out: null, pm_in: null, pm_out: '2026-01-01T17:30:00' },
      ],
    });
    const html = generateDtrHtml(employee, '2026-01-01', '2026-01-01');
    expect(html).toContain('08:05 AM');
    expect(html).toContain('05:30 PM');
  });

  it('shows em-dash for null times', () => {
    const employee = makeEmployee({
      records: [
        { date: '2026-01-01', am_in: '2026-01-01T08:00:00', am_out: null, pm_in: null, pm_out: null },
      ],
    });
    const html = generateDtrHtml(employee, '2026-01-01', '2026-01-01');
    expect(html).toContain('—');
  });

  it('produces valid HTML with required CSC form header', () => {
    const html = generateDtrHtml(makeEmployee(), '2026-01-01', '2026-01-01');
    expect(html).toContain('Civil Service Form No. 48');
    expect(html).toContain('DAILY TIME RECORD');
    expect(html).toContain('<!DOCTYPE html>');
  });
});