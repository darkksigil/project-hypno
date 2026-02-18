import { Router, Request, Response } from 'express';
const { getDb } = require('../../database/db');

const router = Router();

interface PrintRequest {
  employee_ids:  string[];
  employee_type: string;
  from:          string;
  to:            string;
}

// Generate HTML for CSC Form No. 48
function generateDtrHtml(employeeData: any, fromDate: string, toDate: string): string {
  const { name, employee_type, department, records } = employeeData;

  // Build a full list of every date in the range
  const start = new Date(fromDate + 'T00:00:00');
  const end   = new Date(toDate   + 'T00:00:00');
  const allDates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10));
  }

  // Index records by date
  const byDate: Record<string, any> = {};
  for (const r of records) {
    byDate[r.date] = r;
  }

  let absentCount = 0;

  const rows = allDates.map((dateStr) => {
    const r   = byDate[dateStr];
    const d   = new Date(dateStr + 'T00:00:00');
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayLabel = `${d.getDate()} ${days[d.getDay()]}`;

    const hasRecord = r && (r.am_in || r.pm_out);
    if (!hasRecord) absentCount++;

    const amIn  = r ? formatTime(r.am_in)  : '';
    const amOut = r ? formatTime(r.am_out) : '';
    const pmIn  = r ? formatTime(r.pm_in)  : '';
    const pmOut = r ? formatTime(r.pm_out) : '';

    return `
    <tr>
      <td class="td-day">${dayLabel}</td>
      <td class="td-time">${amIn}</td>
      <td class="td-time">${amOut}</td>
      <td class="td-time">${pmIn}</td>
      <td class="td-time">${pmOut}</td>
      <td class="td-num"></td>
      <td class="td-num"></td>
      <td class="td-num"></td>
      <td class="td-num">${hasRecord ? '0' : '1'}</td>
    </tr>`;
  }).join('');

  const fromFmt = formatDateLabel(fromDate);
  const toFmt   = formatDateLabel(toDate);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      line-height: 1.15;
    }

    .header p { font-size: 10pt; margin-bottom: 1px; }
    .header .bold { font-weight: bold; }

    .name-row {
      display: flex;
      align-items: flex-end;
      margin-top: 4px;
      margin-bottom: 0px;
    }
    .name-line {
      flex: 1;
      border-bottom: 1px solid #000;
      font-weight: bold;
      padding-left: 2px;
      min-height: 14px;
    }

    .small-label {
      font-size: 8pt;
      text-align: center;
      margin-bottom: 4px;
    }

    .period-row {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      margin-bottom: 1px;
    }
    .period-line {
      border-bottom: 1px solid #000;
      min-width: 90px;
      display: inline-block;
      padding: 0 2px;
      font-weight: bold;
    }
    .hours-row {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      margin-bottom: 1px;
    }
    .hours-line {
      border-bottom: 1px solid #000;
      min-width: 50px;
      display: inline-block;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      border: 1px solid #000;
    }
    th, td {
      border: 1px solid #000;
      padding: 1px 2px;
      text-align: center;
      font-size: 10pt;
      font-family: "Times New Roman", Times, serif;
      line-height: 1.15;
    }
    .th-top { font-weight: bold; font-size: 10pt; }
    .td-day { text-align: left; padding-left: 3px; white-space: nowrap; }
    .td-time { white-space: nowrap; }
    .td-num { width: 36px; }

    /* Body rows - no borders at all, table outline handled by table border */
    tbody tr td { border: none; }
    /* Total row */
    .tr-total td { border: none; }
    .td-total-label {
      text-align: left;
      padding-left: 3px;
      border-top: 2px solid #000 !important;
      border-bottom: 1px solid #000 !important;
    }
    .td-total-dots {
      border-top: 2px solid #000 !important;
      border-bottom: 1px solid #000 !important;
      letter-spacing: 2px;
      text-align: left;
    }
    .td-total-zero {
      border-top: 2px solid #000 !important;
      border-bottom: 1px solid #000 !important;
      border-left: 1px solid #000 !important;
      border-right: 1px solid #000 !important;
    }
    .td-total-absent {
      border-top: 2px solid #000 !important;
      border-bottom: 1px solid #000 !important;
      border-left: 1px solid #000 !important;
      border-right: 1px solid #000 !important;
    }

    .certification {
      margin-top: 8px;
      font-size: 10pt;
      line-height: 1.4;
    }

    .sig-section { margin-top: 16px; }
    .sig-first {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 20px;
    }
    .sig-first-inner {
      width: 55%;
    }
    .sig-first .sig-line {
      border-top: 1px solid #000;
      padding-top: 2px;
      font-size: 10pt;
    }
    .sig-first .sig-sub {
      font-size: 10pt;
    }
    .sig-second {
      display: flex;
      justify-content: flex-start;
    }
    .sig-second-inner {
      width: 55%;
      text-align: center;
    }
    .sig-second .sig-line {
      display: block;
      border-top: 1px solid #000;
      padding-top: 2px;
      font-size: 10pt;
    }

    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="header">
    <p>Civil Service Form No. 48</p>
    <p><strong>DAILY TIME RECORD</strong></p>
    <p class="bold">${name.toUpperCase()}</p>
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
        <th>IN</th>
        <th>OUT</th>
        <th>IN</th>
        <th>OUT</th>
        <th>MINUTES</th>
        <th>MINUTES</th>
        <th></th>
        <th></th>
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${days[d.getDay()]}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

async function launchPuppeteer() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('Puppeteer not installed. Run: npm install puppeteer');
  }
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
}

// ── GET /dtr/test-pdf ─────────────────────────────────────────────────────────
// Purely tests Puppeteer with hardcoded dummy data — NO database involved
router.get('/test-pdf', async (_req: Request, res: Response) => {
  console.log('[TEST-PDF] Starting Puppeteer test...');
  try {
    const dummyEmployee = {
      employee_id:   'TEST-001',
      name:          'Juan dela Cruz',
      employee_type: 'regular',
      department:    'Test Department',
      records: [
        { date: '2026-01-01', am_in: null, am_out: null, pm_in: null, pm_out: null },
        { date: '2026-01-02', am_in: '2026-01-02T08:00:00', am_out: '2026-01-02T12:00:00', pm_in: '2026-01-02T13:00:00', pm_out: '2026-01-02T17:00:00' },
        { date: '2026-01-03', am_in: '2026-01-03T08:05:00', am_out: '2026-01-03T12:00:00', pm_in: '2026-01-03T13:00:00', pm_out: '2026-01-03T17:00:00' },
      ]
    };

    const html = generateDtrHtml(dummyEmployee, '2026-01-01', '2026-01-15');

    console.log('[TEST-PDF] Launching Puppeteer...');
    const browser = await launchPuppeteer();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    console.log('[TEST-PDF] Success! PDF size:', pdf.length, 'bytes');
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="test-dtr.pdf"',
      'Content-Length':      pdf.length,
    });
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('[TEST-PDF] Failed:', err);
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : String(err)
    });
  }
});

// ── POST /dtr/print ───────────────────────────────────────────────────────────
router.post('/print', async (req: Request, res: Response) => {
  try {
    console.log('[PRINT] Request received:', req.body);

    const { employee_ids, employee_type, from, to }: PrintRequest = req.body;

    if (!employee_ids || !from || !to) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const db = getDb();
    const placeholders = employee_ids.map(() => '?').join(',');
    const query = `
      SELECT d.employee_id, e.name, e.employee_type,
             dep.name AS department,
             d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
      FROM   dtr_records  d
      JOIN   employees    e   ON e.id   = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      WHERE  d.employee_id IN (${placeholders})
        AND  d.date BETWEEN ? AND ?
        AND  e.employee_type = ?
      ORDER BY e.name ASC, d.date ASC
    `;

    const params = [...employee_ids, from, to, employee_type];
    const records = await db.all(query, params);

    console.log('[PRINT] Found records:', records.length);

    if (!records.length) {
      res.status(404).json({ status: 'error', message: 'No DTR records found for this employee.' });
      return;
    }

    const byEmployee = new Map<string, any>();
    for (const r of records) {
      if (!byEmployee.has(r.employee_id)) {
        byEmployee.set(r.employee_id, {
          employee_id:   r.employee_id,
          name:          r.name,
          employee_type: r.employee_type,
          department:    r.department,
          records:       [],
        });
      }
      byEmployee.get(r.employee_id).records.push(r);
    }

    const employees = Array.from(byEmployee.values());
    console.log('[PRINT] Generating HTML for', employees.length, 'employees');

    const htmlPages = employees.map((emp, idx) => {
      const html = generateDtrHtml(emp, from, to);
      return idx < employees.length - 1
        ? html.replace('</body>', '<div class="page-break"></div></body>')
        : html;
    });

    const fullHtml = htmlPages.join('');

    console.log('[PRINT] Launching browser...');
    const browser = await launchPuppeteer();
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await browser.close();

    console.log('[PRINT] PDF generated, size:', pdf.length, 'bytes');
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="dtr-report.pdf"',
      'Content-Length':      pdf.length,
    });
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('[PRINT] Error:', err);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

module.exports = router;