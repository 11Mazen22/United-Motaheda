/**
 * productCsv.ts
 * CSV parsing/template utilities for bulk product import, extracted from
 * ProductManager.tsx so the parsing logic is independently testable and the
 * manager component can stay focused on UI/state concerns.
 *
 * CSV column order (header row required, case-insensitive, order-independent):
 *   code, barcode, name, name_ar, category, price, stock
 *
 * - code: optional — auto-generated (PROD-<timestamp>) when blank.
 * - barcode: optional.
 * - name: required — English product name.
 * - name_ar: optional — Arabic product name.
 * - category: required — matched against an existing category by id, English
 *   name, or Arabic name (case-insensitive).
 * - price: required — non-negative number.
 * - stock: optional — non-negative integer, defaults to 0.
 */

import type { ProductMutationPayload } from "../services/adminSupabaseApi";

export type Language = "ar" | "en";

export const CSV_TEMPLATE_HEADERS = [
  "code",
  "barcode",
  "name",
  "name_ar",
  "category",
  "price",
  "stock",
] as const;

export interface CsvRowError {
  row: number;
  message: string;
}

export interface ParsedCsvRow {
  row: number;
  payload: ProductMutationPayload;
}

export interface CategoryLookup {
  id: string;
  name: string;
  nameEn?: string;
}

/** Splits a single CSV record's raw text into fields, honoring quoted values
 * (RFC4180-style: double-quote wrapping, "" as an escaped quote, commas and
 * newlines allowed inside quotes). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }

    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ",") { pushField(); i += 1; continue; }
    if (char === "\r") { i += 1; continue; }
    if (char === "\n") { pushRow(); i += 1; continue; }
    field += char; i += 1;
  }

  // Flush trailing field/row (file may or may not end with a newline).
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop fully blank trailing rows (common with trailing newlines).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}



/** Parses raw CSV text into validated product payloads, matching the exact
 * shape sent by the single-product create/edit form. Returns both the valid
 * rows (ready to insert) and a list of per-row errors for anything invalid. */
export function parseProductCsv(
  text: string,
  categories: CategoryLookup[],
  lang: Language,
): { rows: ParsedCsvRow[]; errors: CsvRowError[] } {
  const records = parseCsvText(text);
  const errors: CsvRowError[] = [];
  const rows: ParsedCsvRow[] = [];
  const seenCodes = new Map<string, number>();
  const seenBarcodes = new Map<string, number>();

  if (records.length === 0) {
    errors.push({
      row: 0,
      message: lang === "ar" ? "الملف فارغ." : "The file is empty.",
    });
    return { rows, errors };
  }

  const header = records[0].map((h) => h.trim().toLowerCase());
  const colIndex = (col: string) => header.indexOf(col);

  const requiredCols = ["name", "category", "price"];
  const missingCols = requiredCols.filter((c) => colIndex(c) === -1);
  if (missingCols.length > 0) {
    errors.push({
      row: 0,
      message:
        lang === "ar"
          ? `أعمدة مفقودة في الرأس: ${missingCols.join(", ")}`
          : `Missing required column(s) in header: ${missingCols.join(", ")}`,
    });
    return { rows, errors };
  }

  const idxCode = colIndex("code");
  const idxBarcode = colIndex("barcode");
  const idxName = colIndex("name");
  const idxNameAr = colIndex("name_ar");
  const idxCategory = colIndex("category");
  const idxPrice = colIndex("price");
  const idxStock = colIndex("stock");

  const cell = (record: string[], idx: number) => (idx === -1 ? "" : (record[idx] ?? "").trim());

  for (let r = 1; r < records.length; r += 1) {
    const record = records[r];
    const rowNumber = r + 1; // 1-based, including header row, matches spreadsheet row numbers
    const rowErrors: string[] = [];

    const name = cell(record, idxName);
    const categoryRaw = cell(record, idxCategory);
    const priceRaw = cell(record, idxPrice);

    if (!name) {
      rowErrors.push(lang === "ar" ? "الاسم مفقود" : "missing 'name'");
    }
    if (!categoryRaw) {
      rowErrors.push(lang === "ar" ? "القسم مفقود" : "missing 'category'");
    }
    if (!priceRaw) {
      rowErrors.push(lang === "ar" ? "السعر مفقود" : "missing 'price'");
    }

    const price = Number(priceRaw);
    if (priceRaw && (Number.isNaN(price) || price < 0)) {
      rowErrors.push(lang === "ar" ? "السعر غير صالح" : "invalid 'price'");
    }

    const stockRaw = cell(record, idxStock);
    const stock = stockRaw ? Number(stockRaw) : 0;
    if (stockRaw && (Number.isNaN(stock) || stock < 0)) {
      rowErrors.push(lang === "ar" ? "المخزون غير صالح" : "invalid 'stock'");
    }

    let category: CategoryLookup | undefined;
    if (categoryRaw) {
      const needle = categoryRaw.toLowerCase();
      category = categories.find(
        (c) =>
          c.id.toLowerCase() === needle ||
          c.name.toLowerCase() === needle ||
          (c.nameEn ?? "").toLowerCase() === needle,
      );
      if (!category) {
        rowErrors.push(
          lang === "ar"
            ? `القسم غير معروف: "${categoryRaw}"`
            : `unknown category: "${categoryRaw}"`,
        );
      }
    }

    const code = cell(record, idxCode) || `PROD-${Date.now()}-${rowNumber}`;
    const barcode = cell(record, idxBarcode);
    const codeKey = code.toLowerCase();
    const barcodeKey = barcode.toLowerCase();
    if (seenCodes.has(codeKey)) {
      rowErrors.push(lang === "ar" ? `رمز مكرر (الصف ${seenCodes.get(codeKey)})` : `duplicate code (row ${seenCodes.get(codeKey)})`);
    }
    if (barcodeKey && seenBarcodes.has(barcodeKey)) {
      rowErrors.push(lang === "ar" ? `باركود مكرر (الصف ${seenBarcodes.get(barcodeKey)})` : `duplicate barcode (row ${seenBarcodes.get(barcodeKey)})`);
    }


    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        message:
          lang === "ar"
            ? `الصف ${rowNumber}: ${rowErrors.join("، ")}`
            : `Row ${rowNumber}: ${rowErrors.join(", ")}`,
      });
      continue;
    }

    seenCodes.set(codeKey, rowNumber);
    if (barcodeKey) seenBarcodes.set(barcodeKey, rowNumber);

    rows.push({
      row: rowNumber,
      payload: {
        Code: code,
        Barcode: barcode,
        Name: name,
        Name_Ar: cell(record, idxNameAr) || "",
        Name_En: name,
        Price: price,
        Stock: Number.isNaN(stock) ? 0 : stock,
        Category: category!.id,
        Category_Name: category!.name,
        Category_Name_En: category!.nameEn || category!.name,
      } satisfies ProductMutationPayload,
    });
  }

  return { rows, errors };
}

export function downloadCsvTemplate(): void {
  const sampleRow = [
    "",
    "6221031503017",
    "Paracetamol 500mg",
    "باراسيتامول 500 مجم",
    "Pain Relief",
    "25.50",
    "100",
    "false",
    "",
  ];
  const csvContent = [CSV_TEMPLATE_HEADERS.join(","), sampleRow.join(",")].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "product-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
