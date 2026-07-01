import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as mammoth from 'mammoth';

export function parseFile(filePath: string, ext: string): { columns: string[]; rows: any[] } {
  if (ext === '.csv' || ext === '.txt') return parseCsv(filePath);
  if (ext === '.xls' || ext === '.xlsx') return parseExcel(filePath);
  return { columns: [], rows: [] };
}

export async function parseDocument(filePath: string, ext: string): Promise<string> {
  if (ext === '.pdf') return parsePdf(filePath);
  if (ext === '.docx') return parseDocx(filePath);
  throw new Error(`Unsupported document type: ${ext}`);
}

async function parsePdf(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const pdfParse = (await import('pdf-parse')) as any;
  const data = await (pdfParse.default || pdfParse)(buf);
  return data.text || '';
}

async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

function parseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  return { columns, rows };
}

function parseExcel(filePath: string) {
  const workbook = XLSX.readFile(filePath);
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
