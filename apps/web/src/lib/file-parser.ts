import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import * as mammoth from 'mammoth';

export function parseFile(buffer: Buffer, ext: string): { columns: string[]; rows: any[] } {
  if (ext === '.csv' || ext === '.txt') return parseCsv(buffer);
  if (ext === '.xls' || ext === '.xlsx') return parseExcel(buffer);
  return { columns: [], rows: [] };
}

export async function parseDocument(buffer: Buffer, ext: string): Promise<string> {
  if (ext === '.pdf') return parsePdf(buffer);
  if (ext === '.docx') return parseDocx(buffer);
  throw new Error(`Unsupported document type: ${ext}`);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

function parseCsv(buffer: Buffer) {
  const content = buffer.toString('utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  return { columns, rows };
}

function parseExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  return { columns, rows };
}

export function hashRow(row: any): string {
  return crypto.createHash('md5').update(JSON.stringify(row)).digest('hex');
}

export function detectDuplicates(rows: any[]): { rows: any[]; duplicateCount: number } {
  const seen = new Map<string, number>();
  let duplicateCount = 0;
  const tagged = rows.map((row, i) => {
    const hash = hashRow(row);
    const isDuplicate = seen.has(hash);
    if (isDuplicate) duplicateCount++;
    else seen.set(hash, i);
    return { ...row, __hash: hash, __isDuplicate: isDuplicate };
  });
  return { rows: tagged, duplicateCount };
}

export function detectEmptyRows(rows: any[]): number {
  return rows.filter(row =>
    Object.values(row).every(v => v === '' || v === null || v === undefined)
  ).length;
}
