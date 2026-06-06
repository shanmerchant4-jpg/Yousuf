"use server";

import { z } from "zod";
import { Prisma, CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeStatus } from "@/lib/billing";
import { getGraceDays } from "@/lib/settings";
import * as XLSX from "xlsx";

export type ImportResult = {
  error?: string;
  imported?: number;
  skipped?: number;
  errors?: string[];
};

const BATCH_SIZE = 200;
const MAX_ERRORS = 20;

// Loose phone/CNIC: matched against the same patterns as manual entry.
const phoneRegex = /^[0-9\s\-+()]{7,20}$/;
const cnicRegex = /^(\d{13}|\d{5}-\d{7}-\d)$/;

const RowSchema = z.object({
  fullName: z.string().min(1, "fullName is required").max(120, "fullName too long"),
  panel: z.string().min(1).max(50),
  packageName: z.string().min(1, "packageName is required").max(80, "packageName too long"),
  monthlyFee: z.number().int("monthlyFee must be a whole number").min(0, "monthlyFee cannot be negative"),
  phone: z.string().regex(phoneRegex, "invalid phone").nullable(),
  cnic: z.string().regex(cnicRegex, "invalid CNIC").nullable(),
  address: z.string().max(200, "address too long").nullable(),
  area: z.string().max(100, "area too long").nullable(),
  paidUntil: z.date().nullable(),
  notes: z.string().max(2000, "notes too long").nullable(),
});

/** Parse CSV text into rows of string cells. Handles quoted fields, embedded commas, escaped quotes (""), and CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  // flush trailing field/row
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Header aliases -> canonical column key
const HEADER_MAP: Record<string, string> = {
  fullname: "fullName",
  name: "fullName",
  clientname: "fullName",
  "client name": "fullName",
  customer: "fullName",
  phone: "phone",
  mobile: "phone",
  cnic: "cnic",
  address: "address",
  area: "area",
  panel: "panel",
  packagename: "packageName",
  package: "packageName",
  plan: "packageName",
  monthlyfee: "monthlyFee",
  fee: "monthlyFee",
  price: "monthlyFee",
  paiduntil: "paidUntil",
  expiry: "paidUntil",
  "expiry date": "paidUntil",
  expirydate: "paidUntil",
  "paid until": "paidUntil",
  notes: "notes",
  logon: "notes",
  "logon id": "notes",
  loginid: "notes",
};

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Himalaya Network proprietary Excel format
//
// The file uses alternating rows:
//   Data row:    [serial, logon, package, name, cnic, phone, status, expiryDate]
//   Address row: [null,   "Himalaya Network", null, address, ...]
//
// Detection: col A is an integer on data rows and empty on address rows,
//            col B contains "Himalaya Network" on address rows.
// ─────────────────────────────────────────────────────────────────────────────
function isHimalayaFormat(rows: unknown[][]): boolean {
  let matches = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const colA = String(rows[i]?.[0] ?? "").trim();
    const nextColA = String(rows[i + 1]?.[0] ?? "").trim();
    const nextColB = String(rows[i + 1]?.[1] ?? "").toLowerCase();
    if (/^\d+$/.test(colA) && nextColA === "" && nextColB.includes("himalaya")) {
      matches++;
    }
    if (matches >= 2) return true;
  }
  return false;
}

function himalayaToStandardRows(raw: unknown[][]): string[][] {
  const header = ["fullName", "phone", "cnic", "address", "area", "panel", "packageName", "monthlyFee", "paidUntil", "notes"];
  const result: string[][] = [header];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const colA = String(row[0] ?? "").trim();
    if (!/^\d+$/.test(colA)) continue; // skip non-data rows

    const logon = String(row[1] ?? "").trim();       // e.g. "hc119@logon"
    const pkg   = String(row[2] ?? "").trim();       // e.g. "15Mbps"
    const name  = String(row[3] ?? "").trim();       // customer name
    const cnic  = String(row[4] ?? "").trim();       // already formatted with dashes
    const phone = String(row[5] ?? "").trim();       // phone (may come as number)
    // row[6] = status string — computed automatically, skip
    const expiry = row[7];                           // Date object or string

    // Address from the following row, column D (index 3)
    const nextRow = raw[i + 1] as unknown[] | undefined;
    const address = nextRow ? String(nextRow[3] ?? "").trim() : "";

    // Derive panel from logon prefix (hcn… → HCN, hc… → HC)
    const logonLower = logon.replace(/@logon$/i, "").toLowerCase();
    const panel = logonLower.startsWith("hcn") ? "HCN" : "HC";

    // Normalise logon to "xxx@logon" format for the notes field
    const notes = logon
      ? logon.toLowerCase().endsWith("@logon") ? logon : `${logon}@logon`
      : "";

    // Format expiry date as YYYY-MM-DD
    let paidUntil = "";
    if (expiry instanceof Date) {
      paidUntil = expiry.toISOString().split("T")[0];
    } else if (expiry) {
      const d = new Date(String(expiry));
      if (!isNaN(d.getTime())) paidUntil = d.toISOString().split("T")[0];
    }

    result.push([name, phone, cnic, address, "", panel, pkg || "Unknown", "0", paidUntil, notes]);
  }

  return result;
}

/** Convert a 2-D string array back to a CSV string. */
function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
}

/** Parse an Excel file (ArrayBuffer) → CSV text, handling the Himalaya format automatically. */
async function excelToText(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Read rows with raw values so Date objects are preserved
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  if (isHimalayaFormat(rawRows)) {
    // Himalaya Network proprietary alternating-row layout
    const converted = himalayaToStandardRows(rawRows);
    if (converted.length < 2) throw new Error("Could not parse Himalaya Excel format — no data rows found.");
    return rowsToCsv(converted);
  }

  // Standard Excel with column headers — let xlsx convert to CSV directly
  return XLSX.utils.sheet_to_csv(ws, { forceQuotes: false });
}

export async function importCustomers(_prev: unknown, fd: FormData): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  let text = "";

  const file = fd.get("csvFile");
  if (file && typeof file !== "string" && (file as File).size > 0) {
    const f = file as File;
    const fileName = f.name ?? "";
    const isExcel =
      /\.(xlsx|xls|xlsm|xlsb)$/i.test(fileName) ||
      f.type.includes("spreadsheet") ||
      f.type.includes("excel");

    try {
      if (isExcel) {
        text = await excelToText(f);
      } else {
        text = await f.text();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read the file.";
      return { error: msg };
    }
  } else {
    text = String(fd.get("csvText") ?? "");
  }

  text = text.trim();
  if (!text) return { error: "Upload a file (.xlsx, .xls, .csv) or paste data." };

  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "File needs a header row and at least one data row." };

  const headerCells = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex: Record<string, number> = {};
  headerCells.forEach((h, idx) => {
    const key = HEADER_MAP[h];
    if (key && !(key in colIndex)) colIndex[key] = idx;
  });

  if (!("fullName" in colIndex)) {
    return {
      error:
        "Could not find a name column. Make sure your file has a 'fullName' (or 'name' / 'clientName') column.",
    };
  }

  const graceDays = await getGraceDays();
  const now = new Date();

  const errors: string[] = [];
  let skipped = 0;
  const toInsert: Prisma.CustomerCreateManyInput[] = [];

  function cell(cells: string[], key: string): string {
    const idx = colIndex[key];
    return idx === undefined ? "" : (cells[idx] ?? "");
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // Skip completely blank lines.
    if (cells.every((c) => c.trim() === "")) continue;
    const lineNo = r + 1; // human-friendly (1-based, header is line 1)

    const panelRaw = emptyToNull(cell(cells, "panel"));
    const feeRaw = cell(cells, "monthlyFee").trim().replace(/,/g, "");
    const paidUntilRaw = cell(cells, "paidUntil").trim();

    let paidUntil: Date | null = null;
    if (paidUntilRaw !== "") {
      const d = new Date(paidUntilRaw);
      if (isNaN(d.getTime())) {
        skipped++;
        if (errors.length < MAX_ERRORS)
          errors.push(`Line ${lineNo}: invalid paidUntil date "${paidUntilRaw}"`);
        continue;
      }
      paidUntil = d;
    }

    const parsed = RowSchema.safeParse({
      fullName: cell(cells, "fullName").trim(),
      panel: panelRaw ?? "1",
      packageName: cell(cells, "packageName").trim(),
      monthlyFee: feeRaw === "" ? NaN : Number(feeRaw),
      phone: emptyToNull(cell(cells, "phone")),
      cnic: emptyToNull(cell(cells, "cnic")),
      address: emptyToNull(cell(cells, "address")),
      area: emptyToNull(cell(cells, "area")),
      paidUntil,
      notes: emptyToNull(cell(cells, "notes")),
    });

    if (!parsed.success) {
      skipped++;
      if (errors.length < MAX_ERRORS) {
        errors.push(`Line ${lineNo}: ${parsed.error.issues[0]?.message ?? "invalid row"}`);
      }
      continue;
    }

    const d = parsed.data;
    toInsert.push({
      fullName: d.fullName,
      phone: d.phone,
      cnic: d.cnic,
      address: d.address,
      area: d.area,
      panel: d.panel,
      packageName: d.packageName,
      monthlyFee: d.monthlyFee,
      paidUntil: d.paidUntil,
      notes: d.notes,
      status: computeStatus(d.paidUntil, now, graceDays),
    });
  }

  let imported = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);
    try {
      const res = await db.customer.createMany({ data: chunk, skipDuplicates: true });
      imported += res.count;
    } catch (e) {
      console.error(`[importCustomers] batch failed (offset ${i})`, e);
      skipped += chunk.length;
      if (errors.length < MAX_ERRORS) {
        errors.push(`Batch starting at row ${i + 2}: database insert failed.`);
      }
    }
  }

  return { imported, skipped, errors };
}
