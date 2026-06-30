import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatasetsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.dataset.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, slug: true, originalName: true, totalRecords: true,
        qualityScore: true, uploadedAt: true, status: true }
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.dataset.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Dataset not found');
    return d;
  }

  async getRecords(
    id: string, page: number, limit: number,
    showDuplicates: boolean, column?: string, value?: string,
    equalsCol?: string, equalsVal?: string,
    minCol?: string, minVal?: string, maxCol?: string, maxVal?: string,
    dateFromCol?: string, dateFrom?: string, dateToCol?: string, dateTo?: string,
  ) {
    const where: any = { datasetId: id };
    if (!showDuplicates) where.isDuplicate = false;
    if (column && value) {
      where.data = { path: [column], string_contains: value };
    }

    const hasJsFilters = !!(equalsCol || minCol || maxCol || dateFromCol || dateToCol);

    if (hasJsFilters) {
      const all = await this.prisma.dataRecord.findMany({
        where, orderBy: { rowIndex: 'asc' }
      });
      let rows = all.map(r => ({ ...(r.data as Record<string, unknown>), __isDuplicate: r.isDuplicate, __id: r.id }));
      if (equalsCol && equalsVal) {
        const eq = Number(equalsVal);
        if (!isNaN(eq)) rows = rows.filter(r => Number(r[equalsCol]) === eq);
      }
      if (minCol && minVal) {
        const min = Number(minVal);
        if (!isNaN(min)) rows = rows.filter(r => Number(r[minCol]) >= min);
      }
      if (maxCol && maxVal) {
        const max = Number(maxVal);
        if (!isNaN(max)) rows = rows.filter(r => Number(r[maxCol]) <= max);
      }
      if (dateFromCol && dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (!isNaN(from)) rows = rows.filter(r => new Date(String(r[dateFromCol])).getTime() >= from);
      }
      if (dateToCol && dateTo) {
        const to = new Date(dateTo).getTime();
        if (!isNaN(to)) rows = rows.filter(r => new Date(String(r[dateToCol])).getTime() <= to);
      }
      const total = rows.length;
      rows = rows.slice((page - 1) * limit, page * limit);
      return { records: rows, total, page, limit, pages: Math.ceil(total / limit) };
    }

    const [records, total] = await Promise.all([
      this.prisma.dataRecord.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { rowIndex: 'asc' }
      }),
      this.prisma.dataRecord.count({ where })
    ]);
    return { records: records.map(r => ({ ...(r.data as Record<string, unknown>), __isDuplicate: r.isDuplicate, __id: r.id })),
      total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateRecord(id: string, recordId: string, data: any) {
    const d = await this.findOne(id);
    const existing = await this.prisma.dataRecord.findFirst({
      where: { id: recordId, datasetId: id }
    });
    if (!existing) throw new NotFoundException('Record not found');
    const updated = { ...(existing.data as any), ...data };
    return this.prisma.dataRecord.update({
      where: { id: recordId },
      data: { data: updated }
    });
  }

  async transform(id: string, action: string, params?: any) {
    const d = await this.findOne(id);
    const records = await this.prisma.dataRecord.findMany({
      where: { datasetId: id }
    });
    const columns = d.columns as string[];

    switch (action) {
      case 'removeDuplicates': {
        const dupIds = records.filter(r => r.isDuplicate).map(r => r.id);
        if (dupIds.length > 0) {
          await this.prisma.dataRecord.deleteMany({ where: { id: { in: dupIds } } });
        }
        const remaining = await this.prisma.dataRecord.count({ where: { datasetId: id } });
        await this.prisma.dataset.update({
          where: { id }, data: { totalRecords: remaining, duplicateCount: 0 }
        });
        return { removed: dupIds.length, remaining };
      }
      case 'fillMissing': {
        const means: Record<string, number> = {};
        for (const col of columns) {
          const nums = records.map(r => Number((r.data as any)?.[col])).filter(n => !isNaN(n));
          if (nums.length > 0) means[col] = nums.reduce((a, b) => a + b, 0) / nums.length;
        }
        let filled = 0;
        for (const record of records) {
          const row = record.data as any;
          let changed = false;
          for (const col of columns) {
            if (row[col] === '' || row[col] === null || row[col] === undefined) {
              if (means[col] !== undefined) row[col] = +means[col].toFixed(2);
              else row[col] = 'N/A';
              changed = true;
            }
          }
          if (changed) {
            const mode = ['always', 'on_conflict'];
            await this.prisma.dataRecord.update({
              where: { id: record.id }, data: { data: row }
            });
            filled++;
          }
        }
        return { filled };
      }
      case 'dropColumn': {
        const col = params?.column;
        if (!col || !columns.includes(col)) throw new NotFoundException('Column not found');
        for (const record of records) {
          const row = record.data as any;
          delete row[col];
          await this.prisma.dataRecord.update({
            where: { id: record.id }, data: { data: row }
          });
        }
        const newColumns = columns.filter(c => c !== col);
        await this.prisma.dataset.update({
          where: { id }, data: { columns: newColumns }
        });
        return { dropped: col, columns: newColumns };
      }
      case 'renameColumn': {
        const from = params?.from;
        const to = params?.to;
        if (!from || !to || !columns.includes(from)) throw new NotFoundException('Column not found');
        for (const record of records) {
          const row = record.data as any;
          row[to] = row[from];
          delete row[from];
          await this.prisma.dataRecord.update({
            where: { id: record.id }, data: { data: row }
          });
        }
        const newColumns = columns.map(c => c === from ? to : c);
        await this.prisma.dataset.update({
          where: { id }, data: { columns: newColumns }
        });
        return { renamed: { from, to }, columns: newColumns };
      }
      default:
        throw new NotFoundException('Unknown action: ' + action);
    }
  }

  async getInsights(id: string) {
    const d = await this.findOne(id);
    return d.insights;
  }

  async getChartData(id: string) {
    const dataset = await this.findOne(id);
    const columns = dataset.columns as string[];
    const records = await this.prisma.dataRecord.findMany({
      where: { datasetId: id, isDuplicate: false },
      orderBy: { rowIndex: 'asc' }
    });
    const rows = records.map(r => r.data as any);

    const isDateCol = (col: string) => {
      const sample = rows.slice(0, 50).map(r => r[col]).filter(v => v != null && v !== '');
      return sample.length > 0 && sample.every(v => !isNaN(Date.parse(String(v))));
    };

    const catCols = columns.filter(col => {
      const sample = rows.slice(0, 20).map(r => r[col]).filter(Boolean);
      return sample.length > 0 && sample.some(v => isNaN(Number(v))) && !isDateCol(col);
    });

    const numCols = columns.filter(col => {
      const sample = rows.slice(0, 20).map(r => r[col]).filter(Boolean);
      return sample.length > 0 && sample.every(v => !isNaN(Number(v)));
    });

    const dateCols = columns.filter(isDateCol);

    const charts: any[] = [];

    for (const catCol of catCols) {
      for (const numCol of numCols) {
        const grouped: Record<string, number[]> = {};
        for (const row of rows) {
          const key = String(row[catCol] ?? 'Unknown');
          const val = Number(row[numCol]);
          if (!isNaN(val)) {
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(val);
          }
        }
        const sorted = Object.entries(grouped)
          .map(([name, vals]) => ({
            name,
            sum: +vals.reduce((a, b) => a + b, 0).toFixed(2),
            avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
            count: vals.length,
          }))
          .sort((a, b) => b.sum - a.sum)
          .slice(0, 10);

        if (sorted.length > 0) {
          charts.push({
            type: 'bar', title: `${numCol} by ${catCol}`, dataKey: 'sum', data: sorted
          });
          charts.push({
            type: 'pie', title: `${numCol} distribution by ${catCol}`, dataKey: 'sum', data: sorted
          });
        }
      }
    }

    for (const dateCol of dateCols) {
      for (const numCol of numCols) {
        const monthly: Record<string, { sum: number; count: number }> = {};
        for (const row of rows) {
          const d = new Date(row[dateCol]);
          if (isNaN(d.getTime())) continue;
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const val = Number(row[numCol]);
          if (!isNaN(val)) {
            if (!monthly[ym]) monthly[ym] = { sum: 0, count: 0 };
            monthly[ym].sum += val;
            monthly[ym].count++;
          }
        }
        const sorted = Object.entries(monthly)
          .map(([month, v]) => ({ name: month, value: +v.sum.toFixed(2), avg: +(v.sum / v.count).toFixed(2) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (sorted.length > 1) {
          charts.push({
            type: 'line', title: `${numCol} over ${dateCol}`, dataKey: 'value', data: sorted
          });
        }
      }
    }

    if (numCols.length >= 2) {
      for (let i = 0; i < numCols.length; i++) {
        for (let j = i + 1; j < numCols.length; j++) {
          const scatter = rows.map((r, idx) => ({
            x: Number(r[numCols[i]]) || 0,
            y: Number(r[numCols[j]]) || 0,
            id: idx,
          })).filter(p => p.x !== 0 && p.y !== 0);
          if (scatter.length > 0) {
            charts.push({
              type: 'scatter', title: `${numCols[i]} vs ${numCols[j]}`,
              xKey: numCols[i], yKey: numCols[j], data: scatter.slice(0, 500)
            });
          }
        }
      }
    }

    if (catCols.length >= 2 && numCols.length > 0) {
      for (let i = 0; i < catCols.length; i++) {
        for (let j = i + 1; j < catCols.length; j++) {
          const numCol = numCols[0];
          const grid: Record<string, Record<string, number[]>> = {};
          for (const row of rows) {
            const x = String(row[catCols[i]] ?? 'Unknown');
            const y = String(row[catCols[j]] ?? 'Unknown');
            const val = Number(row[numCol]);
            if (!isNaN(val)) {
              if (!grid[x]) grid[x] = {};
              if (!grid[x][y]) grid[x][y] = [];
              grid[x][y].push(val);
            }
          }
          const xKeys = Object.keys(grid);
          const yKeys = [...new Set(Object.values(grid).flatMap(Object.keys))];
          const heatData = xKeys.map(x => {
            const row: any = { name: x };
            yKeys.forEach(y => {
              const vals = grid[x]?.[y];
              row[y] = vals ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0) : 0;
            });
            return row;
          });
          if (heatData.length > 0 && yKeys.length > 0) {
            charts.push({
              type: 'heatmap', title: `${numCol} by ${catCols[i]} × ${catCols[j]}`,
              xKey: catCols[i], yKeys, data: heatData
            });
          }
        }
      }
    }

    return { charts, catCols, numCols, dateCols };
  }

  private sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return clean;
  }

  async queryAll(sql: string, confirm?: boolean) {
    const upper = sql.trim().toUpperCase();
    if (/INSERT|UPDATE|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|--|\/\*/i.test(upper))
      throw new BadRequestException('Statement type not allowed');

    if (upper.startsWith('DROP TABLE')) {
      const match = sql.trim().match(/^DROP\s+TABLE\s+(\S+)/i);
      if (!match) throw new BadRequestException('Invalid DROP TABLE syntax. Usage: DROP TABLE slug_name');
      const slug = match[1].toLowerCase();

      if (!confirm) {
        const ds = await this.prisma.dataset.findUnique({ where: { slug } });
        if (!ds) throw new NotFoundException(`Dataset "${slug}" not found`);
        return { type: 'DROP', affected: ds.totalRecords, name: ds.originalName, preview: true };
      }

      const ds = await this.prisma.dataset.findUnique({ where: { slug } });
      if (!ds) throw new NotFoundException(`Dataset "${slug}" not found`);
      const count = ds.totalRecords;
      await this.prisma.dataset.delete({ where: { id: ds.id } });
      return { type: 'DROP', affected: count, name: ds.originalName, preview: false };
    }

    if (!upper.startsWith('SELECT') && !upper.startsWith('DELETE FROM'))
      throw new BadRequestException('Only SELECT, DELETE FROM table, or DROP TABLE table are allowed');

    const tableRefs = this.extractTableRefs(sql);
    if (tableRefs.length === 0) throw new BadRequestException('No table references found in query');

    const datasets = await this.prisma.dataset.findMany({
      where: { slug: { in: tableRefs } }
    });
    const slugMap = new Map(datasets.map(d => [d.slug, d]));
    for (const ref of tableRefs) {
      if (!slugMap.has(ref)) throw new NotFoundException(`Dataset "${ref}" not found`);
    }

    const ctes: string[] = [];
    for (const ds of datasets) {
      const columns = ds.columns as string[];
      const sample = await this.prisma.dataRecord.findMany({
        where: { datasetId: ds.id, isDuplicate: false },
        take: 20, orderBy: { rowIndex: 'asc' }
      });
      const numericCols = new Set<string>();
      for (const col of columns) {
        const vals = sample.map(r => (r.data as any)[col]).filter((v: any) => v != null && v !== '');
        if (vals.length > 0 && vals.every((v: any) => !isNaN(Number(v)))) numericCols.add(col);
      }

      const fields = columns.map(col => {
        const path = col.replace(/'/g, "''");
        const quoted = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col) ? `"${col.replace(/"/g, '""')}"` : col;
        return numericCols.has(col)
          ? `(data->>'${path}')::numeric AS ${quoted}`
          : `data->>'${path}' AS ${quoted}`;
      });
      ctes.push(`${ds.slug} AS (SELECT ${fields.join(', ')} FROM "DataRecord" WHERE "datasetId" = '${ds.id.replace(/'/g, "''")}' AND "isDuplicate" = false)`);
    }

    try {
      if (upper.startsWith('SELECT')) {
        const q = sql.replace(/;\s*$/, '');
        const full = `WITH ${ctes.join(', ')} ${q} LIMIT 1000`;
        const result = await this.prisma.$queryRawUnsafe(full);
        const rows = (Array.isArray(result) ? result : []).map(r => this.sanitizeRow(r as Record<string, unknown>));
        const resultColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { type: 'SELECT', columns: resultColumns, rows, total: rows.length };
      } else {
        const target = slugMap.get(tableRefs[0])!;
        const rest = sql.replace(/^DELETE\s+FROM\s+\S+\s*/i, '').trim();
        const hasWhere = rest.toUpperCase().startsWith('WHERE');
        const whereClause = hasWhere ? rest.slice(5).trim() : '';

        if (!confirm) {
          const preview = `SELECT COUNT(*) AS count FROM ${target.slug}${whereClause ? ` WHERE ${whereClause}` : ''}`;
          const full = `WITH ${ctes.join(', ')} ${preview}`;
          const result = (await this.prisma.$queryRawUnsafe(full)) as { count: unknown }[];
          return { type: 'DELETE', affected: Number(result[0]?.count ?? 0), preview: true };
        } else {
          const full = `WITH ${ctes.join(', ')} DELETE FROM "DataRecord" d USING ${target.slug} WHERE d.id = ${target.slug}.id${whereClause ? ` AND ${whereClause}` : ''} RETURNING d.id`;
          const result = await this.prisma.$queryRawUnsafe(full);
          const count = Array.isArray(result) ? result.length : 0;
          await this.prisma.dataset.update({
            where: { id: target.id }, data: { totalRecords: { decrement: count } }
          });
          return { type: 'DELETE', affected: count, preview: false };
        }
      }
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Query execution failed');
    }
  }

  private extractTableRefs(sql: string): string[] {
    const refs = new Set<string>();
    const tokens = sql.match(/(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (tokens) {
      for (const t of tokens) {
        const parts = t.split(/\s+/);
        const name = parts[parts.length - 1];
        if (name) refs.add(name.toLowerCase());
      }
    }
    return [...refs];
  }

  async queryDataset(id: string, sql: string, confirm?: boolean) {
    const dataset = await this.findOne(id);
    const columns = dataset.columns as string[];

    if (!/^[a-zA-Z0-9]+$/.test(id))
      throw new BadRequestException('Invalid dataset ID');

    const upper = sql.trim().toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('DELETE FROM _DATA'))
      throw new BadRequestException('Only SELECT or DELETE FROM _data queries are allowed');
    if (/INSERT|UPDATE|DELETE\s+FROM\s+(?!_DATA)|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|--|\/\*/i.test(upper))
      throw new BadRequestException('Statement type not allowed');

    const sample = await this.prisma.dataRecord.findMany({
      where: { datasetId: id, isDuplicate: false },
      take: 20, orderBy: { rowIndex: 'asc' }
    });
    const numericCols = new Set<string>();
    for (const col of columns) {
      const vals = sample.map(r => (r.data as any)[col]).filter((v: any) => v != null && v !== '');
      if (vals.length > 0 && vals.every((v: any) => !isNaN(Number(v)))) numericCols.add(col);
    }

    const escId = (s: string) => s.replace(/'/g, "''");
    const needsQuote = (s: string) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
    const safeId = escId(id);

    const cteFields = columns.map(col => {
      const path = escId(col);
      const quoted = needsQuote(col) ? `"${col.replace(/"/g, '""')}"` : col;
      return numericCols.has(col)
        ? `(data->>'${path}')::numeric AS ${quoted}`
        : `data->>'${path}' AS ${quoted}`;
    });

    const cte = `_data AS (SELECT ${cteFields.join(', ')} FROM "DataRecord" WHERE "datasetId" = '${safeId}' AND "isDuplicate" = false)`;

    try {
      if (upper.startsWith('DELETE')) {
        const rest = sql.replace(/^DELETE\s+FROM\s+_data\s*/i, '').trim();
        const hasWhere = rest.toUpperCase().startsWith('WHERE');
        const whereClause = hasWhere ? rest.slice(5).trim() : '';

        if (!confirm) {
          const preview = `SELECT COUNT(*) AS count FROM ${rest ? `_data WHERE ${whereClause}` : '_data'}`;
          const full = `WITH ${cte} ${preview}`;
          const result = (await this.prisma.$queryRawUnsafe(full)) as { count: unknown }[];
          return { type: 'DELETE', affected: Number(result[0]?.count ?? 0), preview: true };
        } else {
          const full = `WITH ${cte} DELETE FROM "DataRecord" d USING _data WHERE d.id = _data.id${whereClause ? ` AND ${whereClause}` : ''} RETURNING d.id`;
          const result = await this.prisma.$queryRawUnsafe(full);
          const count = Array.isArray(result) ? result.length : 0;
          await this.prisma.dataset.update({
            where: { id }, data: { totalRecords: { decrement: count } }
          });
          return { type: 'DELETE', affected: count, preview: false };
        }
      } else {
        const q = sql.replace(/;\s*$/, '');
        const full = `WITH ${cte} ${q} LIMIT 1000`;
        const result = await this.prisma.$queryRawUnsafe(full);
        const rows = (Array.isArray(result) ? result : []).map(r => this.sanitizeRow(r as Record<string, unknown>));
        const resultColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { type: 'SELECT', columns: resultColumns, rows, total: rows.length };
      }
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Query execution failed');
    }
  }
}
