import { prisma } from './prisma';
import { Parser as Json2csv } from 'json2csv';
import * as ExcelJS from 'exceljs';

export async function exportCsv(datasetId: string, excludeDuplicates = false): Promise<string> {
  const records = await getRecords(datasetId, excludeDuplicates);
  const parser = new Json2csv();
  return parser.parse(records);
}

export async function exportExcel(datasetId: string, excludeDuplicates = false): Promise<Buffer> {
  const records = await getRecords(datasetId, excludeDuplicates);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  if (records.length > 0) {
    ws.columns = Object.keys(records[0]).map(k => ({ header: k, key: k, width: 18 }));
    records.forEach(r => ws.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer()) as Buffer;
}

async function getRecords(datasetId: string, excludeDuplicates: boolean) {
  const rows = await prisma.dataRecord.findMany({
    where: { datasetId, ...(excludeDuplicates ? { isDuplicate: false } : {}) },
    orderBy: { rowIndex: 'asc' },
  });
  return rows.map(r => r.data as any);
}

export async function exportRows(columns: string[], rows: Record<string, unknown>[], format: 'csv' | 'excel'): Promise<string | Buffer> {
  if (format === 'csv') {
    const parser = new Json2csv();
    return parser.parse(rows);
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Query Results');
  if (rows.length > 0) {
    ws.columns = columns.map(c => ({ header: c, key: c, width: 18 }));
    rows.forEach(r => ws.addRow(r));
  }
  return Buffer.from(await wb.xlsx.writeBuffer()) as Buffer;
}
