// Excel → JSON converters, run entirely in the browser.
// Loaded lazily by admin.html when the admin chooses a .xlsx file.
//
// The rules encoded here must stay aligned with:
//   - excel_to_json_conversion_rules.md   (Payments / data.json)
//   - the tickets rules captured in SECURITY_RUNBOOK.md / chat
//   - memory: reference_eqarat_data_update.md (Eqarat)

import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs';

// ──────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date)      return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
  }
  // Strings: try DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, ISO, or let Date parse it.
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/))) {
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtDDMMYYYY(v) {
  const d = toDate(v);
  if (!d) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

function fmtISODate(v) {
  const d = toDate(v);
  if (!d) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function fmtMonYY(v) {
  const d = toDate(v);
  if (!d) return '';
  return `${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
}

function fmtCurrency(v) {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  if (!isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

function str(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

// Unit types arrive with inconsistent casing between exports ("Villa" in most
// rows, "VILLA" in others). Left as-is they group as two separate unit types
// on the Management Overview. Normalise to Title Case.
function normalizeUnitType(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Bedroom / unit-subtype information is labelled differently by each source
// system. Tried in order; the first non-empty match wins. When none match, the
// Management Overview shows the subtype as "Unknown", which is the signal that
// a new variant needs adding here.
const BEDROOM_HEADERS = [
  'Bedrooms', 'Bedroom', 'Beds', 'Bed', 'Bed Rooms', 'BR', 'B/R',
  'No of Bedrooms', 'No. of Bedrooms', 'Nos of Bedrooms', 'Number of Bedrooms',
  'Number Of Beds', 'No of Beds', 'No. of Beds', 'Nos of Beds', 'Number of Bed',
  'Unit Details', 'Unit Detail', 'Unit Description',
  'Unit Subtype', 'Unit Sub Type', 'Unit Sub-Type', 'Subtype', 'Sub Type', 'Sub-Type',
  'Configuration', 'Unit Configuration', 'Layout', 'Unit Layout', 'Type Details',
];

// Last-resort fallback: the first populated column whose heading mentions
// "bed" at all. Exact aliases are tried first so behaviour stays predictable;
// this only catches spellings nobody anticipated.
function pickBedroomsLoose(row) {
  for (const k of Object.keys(row)) {
    if (/bed/i.test(String(k))) {
      const v = row[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return '';
}

function normalizeBedrooms(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^studio/i.test(s) || s === '0' || /^0\s*(B\/?R|BR|Bed)/i.test(s)) return 'Studio';
  if (/penthouse/i.test(s)) return 'Penthouse';
  const m = s.match(/(\d+)/);
  return m ? `${m[1]}BR` : s;
}

async function readSheet(file) {
  const buf = await file.arrayBuffer();
  // Read date cells as Excel serial numbers, NOT cellDates. cellDates would
  // build Date objects anchored to the uploader's local timezone, which the
  // getUTC* formatters below then misread — shifting month-boundary payments
  // into the wrong month depending on where the upload happened. Serials go
  // through toDate()'s Date.UTC path, giving the same result in any timezone.
  const wb  = XLSX.read(buf);
  const ws  = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// Look up a column by trying several candidate header names (case-insensitive,
// trimmed). Returns the value from the row, or '' if none match.
function pick(row, ...candidates) {
  const norm = (s) => String(s).trim().toLowerCase();
  const lookup = {};
  for (const k of Object.keys(row)) lookup[norm(k)] = row[k];
  for (const c of candidates) {
    const v = lookup[norm(c)];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function blobJSON(obj) {
  return new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
}

// ──────────────────────────────────────────────────────────────────
// Payments → data.json
// Rules: excel_to_json_conversion_rules.md
// ──────────────────────────────────────────────────────────────────
export async function convertPayments(xlsxFile) {
  const rows = await readSheet(xlsxFile);
  if (!rows.length) throw new Error('Payments workbook appears empty.');

  const out = rows.map((r) => {
    // "Paid Amount " has a trailing space in the source — look up either form.
    const paidAmount = r['Paid Amount '] ?? r['Paid Amount'];

    return {
      'Order ID':         str(r['Order ID']),
      'Bank Ref':         str(r['Bank Ref']),
      'Paid Date':        fmtDDMMYYYY(r['Paid Date']),
      'Payment Type':     str(r['Payment Type']),
      'Due Date':         fmtDDMMYYYY(r['Due Date']),
      'Due Amount':       fmtCurrency(r['Due Amount']),
      'VAT':              num(r['VAT']) ?? 0,
      'Processing Fee':   num(r['Processing Fee']) ?? 0,
      'Gross Amount':     fmtCurrency(r['Gross Amount']),
      'Organization':     str(r['Organization']),
      'Business Unit':    str(r['Business Unit']),
      'Property':         str(r['Property']),
      'Unit Code':        str(r['Unit Code']),
      'Status':           str(r['Status']),
      'Autopay':          str(r['Autopay']),
      'PaidUpfront':      str(r['PaidUpfront']),
      'MID':              num(r['MID']) ?? '',
      'Payment Sub Type': str(r['Payment Sub Type']),
      'Tenant Name':      str(r['Tenant Name']),
      'Tenant Email':     str(r['Tenant Email']),
      'Lease Start Date': fmtDDMMYYYY(r['Lease Start Date']),
      'SR Number':        str(r['SR Number']),
      'Paid Month':       fmtMonYY(r['Paid Date']),
      'Paid Amount':      fmtCurrency(paidAmount),
    };
  });

  return { blob: blobJSON(out), count: out.length };
}

// ──────────────────────────────────────────────────────────────────
// Tickets → tickets.json
// Rules: filter Paid=Yes, DD-MM-YYYY for all date columns, numerics kept,
//        strings stripped, empty cells → "", original column order preserved.
// ──────────────────────────────────────────────────────────────────
const TICKET_DATE_FIELDS = new Set([
  'Requested Date', 'Slot Date', 'Pending Schedule Date', 'Acknowledged Date',
  'Reached Date', 'In Progress Date', 'Pending Payment Date',
  'Payment Received Date', 'Completed Date', 'Closed Date', 'Rejected Date',
]);
const TICKET_NUMERIC_FIELDS = new Set([
  'Quantity', 'Original Amount (AED)', 'Vat (%)', 'Discount (%)',
  'Final Amount (AED)', 'Rating',
]);

export async function convertTickets(xlsxFile) {
  const rows = await readSheet(xlsxFile);
  if (!rows.length) throw new Error('Tickets workbook appears empty.');

  const paid = rows.filter((r) => String(r['Paid'] ?? '').trim().toLowerCase() === 'yes');
  const headers = Object.keys(rows[0]); // preserve original column order

  const out = paid.map((r) => {
    const obj = {};
    for (const h of headers) {
      const v = r[h];
      if (TICKET_DATE_FIELDS.has(h)) {
        obj[h] = fmtDDMMYYYY(v);
      } else if (TICKET_NUMERIC_FIELDS.has(h)) {
        const n = num(v);
        obj[h] = n === null ? '' : n;
      } else if (v == null || v === '') {
        obj[h] = '';
      } else if (v instanceof Date) {
        obj[h] = fmtDDMMYYYY(v); // safety net for any other date cells
      } else {
        obj[h] = String(v).trim();
      }
    }
    return obj;
  });

  return { blob: blobJSON(out), count: out.length };
}

// ──────────────────────────────────────────────────────────────────
// Management Overview (Units + Leases) → per-organisation data.json
// Two input files: Units + Leases. Join key: Unit Number = Unit Code.
// Payload: { units, leases, properties, owners }
//
// convertOverview()  → pure JSON blob, written to
//                      private/overview/{orgId}/data.json  (current format)
// convertEqarat()    → legacy `const EQARAT_DATA = {...};` JavaScript blob,
//                      written to private/eqarat_data.js. Retained only so
//                      the old single-org path keeps working; not used by the
//                      admin UI any more.
// ──────────────────────────────────────────────────────────────────
// Residential is a closed list of three unit types; everything else that has
// a unit type at all is Commercial. Previously unlisted types fell into an
// "Other" bucket that was excluded from both sub-totals, so a single unusual
// unit type made the KPI cards stop reconciling with the headline total.
// A blank Unit Type stays unclassified — there is nothing to classify it on,
// and the overview surfaces it explicitly rather than guessing.
const RESIDENTIAL_UNIT_TYPES = /apartment|villa|penthouse/;

function usageTypeFor(unitType) {
  const t = String(unitType || '').trim().toLowerCase();
  if (!t) return '';
  return RESIDENTIAL_UNIT_TYPES.test(t) ? 'Residential' : 'Commercial';
}

async function buildOverviewPayload(unitsFile, leasesFile) {
  const [unitRows, leaseRows] = await Promise.all([
    readSheet(unitsFile),
    readSheet(leasesFile),
  ]);
  if (!unitRows.length)  throw new Error('Units workbook appears empty.');
  if (!leaseRows.length) throw new Error('Lease workbook appears empty.');

  const units = unitRows.map((r) => {
    const unitType = normalizeUnitType(pick(r, 'Unit Type'));
    return {
      status:        str(pick(r, 'Unit Status', 'Status')),
      unit_type:     unitType,
      unit_code:     str(pick(r, 'Unit Number', 'Unit Code', 'Unit No')),
      property:      str(pick(r, 'Property', 'Property Name')),
      bedrooms:      normalizeBedrooms(pick(r, ...BEDROOM_HEADERS) || pickBedroomsLoose(r)),
      built_up_area: num(pick(r, 'Built Up Area', 'BUA', 'Built-Up Area')),
      approved_rate: num(pick(r, 'Approved Rate', 'Rate', 'Approved Rent')),
      usage_type:    usageTypeFor(unitType),
    };
  });

  const unitByCode = {};
  for (const u of units) {
    if (u.unit_code) unitByCode[u.unit_code] = u;
  }

  const leases = leaseRows.map((r) => {
    const unitCode = str(pick(r, 'Unit Code', 'Unit Number', 'Unit No'));
    const u = unitByCode[unitCode] || {};
    return {
      status:           str(pick(r, 'Status', 'Lease Status', 'Contract Status')),
      property:         str(pick(r, 'Property', 'Property Name')) || u.property || '',
      unit_code:        unitCode,
      tenant:           str(pick(r, 'Tenant Name', 'Tenant', 'Lessee')),
      annual_rent:      num(pick(r, 'Annual Rent', 'Rent', 'Contract Value')),
      start_date:       fmtISODate(pick(r, 'Start Date', 'Contract Start Date', 'Lease Start Date')),
      end_date:         fmtISODate(pick(r, 'End Date', 'Contract End Date', 'Lease End Date')),
      nationality:      str(pick(r, 'Nationality')),
      bedrooms:         u.bedrooms || normalizeBedrooms(pick(r, ...BEDROOM_HEADERS) || pickBedroomsLoose(r)),
      usage_type:       u.usage_type || usageTypeFor(pick(r, 'Unit Type')),
      unit_type:        u.unit_type || normalizeUnitType(pick(r, 'Unit Type')),
      owner:            str(pick(r, 'Owner', 'Landlord', 'Owner Name')),
      ejari_no:         str(pick(r, 'Ejari No', 'Ejari Number', 'Ejari')),
      mobile:           num(pick(r, 'Mobile', 'Phone', 'Contact Number', 'Mobile Number')),
      email:            str(pick(r, 'Email', 'Email Address')),
      contract_type:    str(pick(r, 'Contract Type', 'Type')),
      installments:     num(pick(r, 'Installments', 'No of Cheques', 'Payment Frequency')),
      security_deposit: num(pick(r, 'Security Deposit', 'Deposit')),
      built_up_area:    u.built_up_area ?? num(pick(r, 'Built Up Area', 'BUA')),
    };
  });

  const properties = [...new Set(units.map((u) => u.property).filter(Boolean))].sort();
  const owners     = [...new Set(leases.map((l) => l.owner).filter(Boolean))].sort();

  return { units, leases, properties, owners };
}

// Current format: pure JSON, one file per organisation.
export async function convertOverview(unitsFile, leasesFile) {
  const payload = await buildOverviewPayload(unitsFile, leasesFile);
  // NaN is invalid JSON, but we've already coerced numerics with num() → null.
  return {
    blob:  blobJSON(payload),
    count: payload.units.length + payload.leases.length,
  };
}

// Legacy format: executable JS assigning a global. Kept for backwards
// compatibility with private/eqarat_data.js only.
export async function convertEqarat(unitsFile, leasesFile) {
  const payload = await buildOverviewPayload(unitsFile, leasesFile);
  const js = 'const EQARAT_DATA = ' + JSON.stringify(payload) + ';\n';
  return {
    blob:  new Blob([js], { type: 'application/javascript' }),
    count: payload.units.length + payload.leases.length,
  };
}
