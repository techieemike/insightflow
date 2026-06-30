import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as crypto from 'crypto';


@Injectable()
export class FileParserService {
  parseFile(filePath: string, ext: string): { columns: string[]; rows: any[] } {
    if (ext === '.csv' || ext === '.txt') return this.parseCsv(filePath);
    return this.parseExcel(filePath);
  }


  private parseCsv(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
    return { columns, rows };
  }


  private parseExcel(filePath: string) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
    return { columns, rows };
  }


  hashRow(row: any): string {
    return crypto.createHash('md5').update(JSON.stringify(row)).digest('hex');
  }


  detectDuplicates(rows: any[]): { rows: any[]; duplicateCount: number } {
    const seen = new Map<string, number>();
    let duplicateCount = 0;
    const tagged = rows.map((row, i) => {
      const hash = this.hashRow(row);
      const isDuplicate = seen.has(hash);
      if (isDuplicate) duplicateCount++;
      else seen.set(hash, i);
      return { ...row, __hash: hash, __isDuplicate: isDuplicate };
    });
    return { rows: tagged, duplicateCount };
  }


  detectEmptyRows(rows: any[]): number {
    return rows.filter(row =>
      Object.values(row).every(v => v === '' || v === null || v === undefined)
    ).length;
  }
}
