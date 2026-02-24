import { getDb }    from '../../database/db';
import { AppError } from '../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────

export interface PrintParams {
  employee_ids:  string[];
  employee_type: string;
  from:          string;
  to:            string;
}

export interface EmployeeDtrData {
  employee_id:   string;
  name:          string;        // display name (fallback)
  surname:       string | null;
  first_name:    string | null;
  middle_name:   string | null;
  employee_type: string;
  department:    string;
  records:       DtrRecord[];
}

interface DtrRecord {
  date:   string;
  am_in:  string | null;
  am_out: string | null;
  pm_in:  string | null;
  pm_out: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const dt   = new Date(iso);
  let h      = dt.getHours();
  const min  = dt.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`;
}

// Build PDF header name:
// If name parts exist → DELA CRUZ, Juan Santos
// Fallback → whatever is stored in name column
function buildPdfName(emp: EmployeeDtrData): string {
  if (emp.surname && emp.first_name) {
    const last   = emp.surname.trim().toUpperCase();
    const first  = emp.first_name.trim();
    const middle = emp.middle_name?.trim();
    return middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
  }
  return emp.name.toUpperCase();
}

// ─── Data Fetching ────────────────────────────────────────────

export async function getEmployeeDtrData(params: PrintParams): Promise<EmployeeDtrData[]> {
  const { employee_ids, employee_type, from, to } = params;
  const db           = getDb();
  const placeholders = employee_ids.map(() => '?').join(',');

  const records = await db.all(
    `SELECT d.employee_id,
            e.name, e.surname, e.first_name, e.middle_name,
            e.employee_type,
            dep.name AS department,
            d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
     FROM   dtr_records  d
     JOIN   employees    e   ON e.id   = d.employee_id
     LEFT JOIN departments dep ON dep.id = e.department_id
     WHERE  d.employee_id IN (${placeholders})
       AND  d.date BETWEEN ? AND ?
       AND  e.employee_type = ?
     ORDER BY e.name ASC, d.date ASC`,
    [...employee_ids, from, to, employee_type],
  );

  if (!records.length) {
    throw new AppError(404, 'No DTR records found for selected employees in this date range.', 'NOT_FOUND');
  }

  const byEmployee = new Map<string, EmployeeDtrData>();
  for (const r of records) {
    if (!byEmployee.has(r.employee_id)) {
      byEmployee.set(r.employee_id, {
        employee_id:   r.employee_id,
        name:          r.name,
        surname:       r.surname   ?? null,
        first_name:    r.first_name ?? null,
        middle_name:   r.middle_name ?? null,
        employee_type: r.employee_type,
        department:    r.department ?? '',
        records:       [],
      });
    }
    byEmployee.get(r.employee_id)!.records.push({
      date:   r.date,
      am_in:  r.am_in,
      am_out: r.am_out,
      pm_in:  r.pm_in,
      pm_out: r.pm_out,
    });
  }

  return Array.from(byEmployee.values());
}

// ─── HTML Generation ─────────────────────────────────────────

export function generateDtrHtml(employeeData: EmployeeDtrData, fromDate: string, toDate: string): string {
  const pdfName = buildPdfName(employeeData);
  const { records } = employeeData;

  const allDates: string[] = [];
  const [sy, sm, sd] = fromDate.split('-').map(Number);
  const [ey, em, ed] = toDate.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    allDates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }

  const byDate: Record<string, DtrRecord> = {};
  for (const r of records) byDate[r.date] = r;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let absentCount = 0;

  const rows = allDates.map((dateStr) => {
    const r   = byDate[dateStr];
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt  = new Date(y, m - 1, d);
    const label = `${dt.getDate()} ${days[dt.getDay()]}`;
    const hasRecord = r && (r.am_in || r.pm_out);
    if (!hasRecord) absentCount++;
    return `
    <tr>
      <td class="td-day">${label}</td>
      <td class="td-time">${r ? formatTime(r.am_in)  : ''}</td>
      <td class="td-time">${r ? formatTime(r.am_out) : ''}</td>
      <td class="td-time">${r ? formatTime(r.pm_in)  : ''}</td>
      <td class="td-time">${r ? formatTime(r.pm_out) : ''}</td>
      <td class="td-num"></td>
      <td class="td-num"></td>
      <td class="td-num"></td>
      <td class="td-num">${hasRecord ? '0' : '1'}</td>
    </tr>`;
  }).join('');

  const fromFmt = formatDateLabel(fromDate);
  const toFmt   = formatDateLabel(toDate);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.15; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid #000; }
    th, td { border: 1px solid #000; padding: 1px 2px; text-align: center; font-size: 10pt; font-family: "Times New Roman", Times, serif; line-height: 1.15; }
    .th-top { font-weight: bold; font-size: 10pt; }
    .td-day { text-align: left; padding-left: 3px; white-space: nowrap; }
    .td-time { white-space: nowrap; }
    .td-num { width: 36px; }
    tbody tr td { border: none; }
    .tr-total td { border: none; }
    .td-total-label { text-align: left; padding-left: 3px; border-top: 2px solid #000 !important; border-bottom: 1px solid #000 !important; }
    .td-total-dots  { border-top: 2px solid #000 !important; border-bottom: 1px solid #000 !important; letter-spacing: 2px; text-align: left; }
    .td-total-zero  { border-top: 2px solid #000 !important; border-bottom: 1px solid #000 !important; border-left: 1px solid #000 !important; border-right: 1px solid #000 !important; }
    .td-total-absent { border-top: 2px solid #000 !important; border-bottom: 1px solid #000 !important; border-left: 1px solid #000 !important; border-right: 1px solid #000 !important; }
    .certification { margin-top: 8px; font-size: 10pt; line-height: 1.4; padding-bottom: 50px; }
    .sig-section { margin-top: 16px; }
    .sig-first { display: flex; justify-content: flex-start; margin-bottom: 20px; }
    .sig-first-inner { width: 55%; }
    .sig-line { border-top: 1px solid #000; padding-top: 2px; font-size: 10pt; }
    .sig-sub { font-size: 10pt; padding-bottom: 50px; }
    .sig-second { display: flex; justify-content: flex-start; }
    .sig-second-inner { width: 55%; text-align: center; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="header">
    <p>Civil Service Form No. 48</p>
    <p><strong>DAILY TIME RECORD</strong></p>
    <p><strong>${pdfName}</strong></p>
    <p>For the Period of ${fromFmt} to ${toFmt}</p>
    <p>Official hours for arrival &nbsp;(Regular Days <span style="border-bottom:1px solid #000; padding: 0 20px;">&nbsp;</span> &nbsp;)</p>
    <p>and departure &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Saturdays <span style="border-bottom:1px solid #000; padding: 0 20px;">&nbsp;</span> &nbsp;)</p>
  </div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" class="th-top" style="width:70px;">Day</th>
        <th colspan="2" class="th-top">A.M.</th>
        <th colspan="2" class="th-top">P.M.</th>
        <th class="th-top">Undertime</th>
        <th class="th-top">Lates</th>
        <th class="th-top">Times<br>U/L</th>
        <th class="th-top">Absence</th>
      </tr>
      <tr>
        <th>IN</th><th>OUT</th><th>IN</th><th>OUT</th>
        <th>MINUTES</th><th>MINUTES</th><th></th><th></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="tr-total">
        <td class="td-total-label">TOTAL</td>
        <td class="td-total-dots" colspan="3">.................................</td>
        <td class="td-total-zero">0</td>
        <td class="td-total-zero">0</td>
        <td class="td-total-zero">0</td>
        <td class="td-total-zero">0</td>
        <td class="td-total-absent">${absentCount}</td>
      </tr>
    </tbody>
  </table>
  <div class="certification">
    <p>&nbsp;</p>
    <p>I certify on my honor that the above is a true and correct report of the hours of worked performed, record of which was made daily at the time of arrival and departure from office.</p>
  </div>
  <div class="sig-section">
    <div class="sig-first">
      <div class="sig-first-inner">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-sub">Verified as to the prescribed office hours.</div>
      </div>
    </div>
    <div class="sig-second">
      <div class="sig-second-inner">
        <div class="sig-line">&nbsp;</div>
        <div style="font-size:10pt;">In charge</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── PDF Generation ───────────────────────────────────────────

export async function generatePdf(htmlPages: string[]): Promise<Buffer> {
  let puppeteer: any;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new AppError(500, 'Puppeteer not installed. Run: npm install puppeteer', 'PDF_UNAVAILABLE');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlPages.join(''), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}