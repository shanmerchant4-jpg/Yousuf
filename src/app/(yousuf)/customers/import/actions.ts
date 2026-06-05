"use server";

import { z } from "zod";
import { Prisma, CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeStatus } from "@/lib/billing";
import { getGraceDays } from "@/lib/settings";

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
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush trailing field/row
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Header aliases -> canonical column key
const HEADER_MAP: Record<string, string> = {
  fullname: "fullName",
  name: "fullName",
  phone: "phone",
  cnic: "cnic",
  address: "address",
  area: "area",
  panel: "panel",
  packagename: "packageName",
  package: "packageName",
  monthlyfee: "monthlyFee",
  fee: "monthlyFee",
  paiduntil: "paidUntil",
  notes: "notes",
};

function emptyToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export async function importCustomers(_prev: unknown, fd: FormData): Promise<ImportResult> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  // Prefer uploaded file; fall back to pasted text.
  let text = String(fd.get("csvText") ?? "");
  const file = fd.get("csvFile");
  if (file && typeof file !== "string" && file.size > 0) {
    text = await file.text();
  }
  text = text.trim();
  if (!text) return { error: "Paste CSV text or choose a .csv file." };

  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "CSV needs a header row and at least one data row." };

  const headerCells = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex: Record<string, number> = {};
  headerCells.forEach((h, idx) => {
    const key = HEADER_MAP[h];
    if (key && !(key in colIndex)) colIndex[key] = idx;
  });

  if (!("fullName" in colIndex)) {
    return { error: "CSV must include a 'fullName' (or 'name') column." };
  }

  const graceDays = await getGraceDays();
  const now = new Date();

  const errors: string[] = [];
  let skipped = 0;
  const toInsert: Prisma.CustomerCreateManyInput[] = [];

  function cell(cells: string[], key: string): string {
    const idx = colIndex[key];
    return idx === undefined ? "" : cells[idx] ?? "";
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // Skip completely blank lines.
    if (cells.every((c) => c.trim() === "")) {
      continue;
    }
    const lineNo = r + 1; // human-friendly (1-based, header is line 1)

    const panelRaw = emptyToNull(cell(cells, "panel"));
    const feeRaw = cell(cells, "monthlyFee").trim().replace(/,/g, "");
    const paidUntilRaw = cell(cells, "paidUntil").trim();

    let paidUntil: Date | null = null;
    if (paidUntilRaw !== "") {
      const d = new Date(paidUntilRaw);
      if (isNaN(d.getTime())) {
        skipped++;
        if (errors.length < MAX_ERRORS) errors.push(`Line ${lineNo}: invalid paidUntil date "${paidUntilRaw}"`);
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
