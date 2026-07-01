import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])
  );
}

function extractTableRefs(sql: string): string[] {
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

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const { sql, confirm } = await request.json() as { sql: string; confirm?: boolean };
    if (!sql || !sql.trim()) {
      return NextResponse.json({ message: 'SQL query is required' }, { status: 400 });
    }

    const upper = sql.trim().toUpperCase();
    if (/INSERT|UPDATE|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|--|\/\*/i.test(upper))
      return NextResponse.json({ message: 'Statement type not allowed' }, { status: 400 });

    if (upper.startsWith('DROP TABLE')) {
      const match = sql.trim().match(/^DROP\s+TABLE\s+(\S+)/i);
      if (!match)
        return NextResponse.json({ message: 'Invalid DROP TABLE syntax. Usage: DROP TABLE slug_name' }, { status: 400 });
      const slug = match[1].toLowerCase();

      if (!confirm) {
        const ds = await prisma.dataset.findUnique({ where: { slug } });
        if (!ds) return NextResponse.json({ message: `Dataset "${slug}" not found` }, { status: 404 });
        return NextResponse.json({ type: 'DROP', affected: ds.totalRecords, name: ds.originalName, preview: true });
      }

      const ds = await prisma.dataset.findUnique({ where: { slug } });
      if (!ds) return NextResponse.json({ message: `Dataset "${slug}" not found` }, { status: 404 });
      const count = ds.totalRecords;
      await prisma.dataset.delete({ where: { id: ds.id } });
      return NextResponse.json({ type: 'DROP', affected: count, name: ds.originalName, preview: false });
    }

    if (!upper.startsWith('SELECT') && !upper.startsWith('DELETE FROM'))
      return NextResponse.json({ message: 'Only SELECT, DELETE FROM table, or DROP TABLE table are allowed' }, { status: 400 });

    const tableRefs = extractTableRefs(sql);
    if (tableRefs.length === 0)
      return NextResponse.json({ message: 'No table references found in query' }, { status: 400 });

    const datasets = await prisma.dataset.findMany({
      where: { slug: { in: tableRefs } }
    });
    const slugMap = new Map(datasets.map(d => [d.slug, d]));
    for (const ref of tableRefs) {
      if (!slugMap.has(ref))
        return NextResponse.json({ message: `Dataset "${ref}" not found` }, { status: 404 });
    }

    const ctes: string[] = [];
    for (const ds of datasets) {
      const columns = ds.columns as string[];
      const sample = await prisma.dataRecord.findMany({
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
        const result = await prisma.$queryRawUnsafe(full);
        const rows = (Array.isArray(result) ? result : []).map(r => sanitizeRow(r as Record<string, unknown>));
        const resultColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return NextResponse.json({ type: 'SELECT', columns: resultColumns, rows, total: rows.length });
      } else {
        const target = slugMap.get(tableRefs[0])!;
        const rest = sql.replace(/^DELETE\s+FROM\s+\S+\s*/i, '').trim();
        const hasWhere = rest.toUpperCase().startsWith('WHERE');
        const whereClause = hasWhere ? rest.slice(5).trim() : '';

        if (!confirm) {
          const preview = `SELECT COUNT(*) AS count FROM ${target.slug}${whereClause ? ` WHERE ${whereClause}` : ''}`;
          const full = `WITH ${ctes.join(', ')} ${preview}`;
          const result = (await prisma.$queryRawUnsafe(full)) as { count: unknown }[];
          return NextResponse.json({ type: 'DELETE', affected: Number(result[0]?.count ?? 0), preview: true });
        } else {
          const full = `WITH ${ctes.join(', ')} DELETE FROM "DataRecord" d USING ${target.slug} WHERE d.id = ${target.slug}.id${whereClause ? ` AND ${whereClause}` : ''} RETURNING d.id`;
          const result = await prisma.$queryRawUnsafe(full);
          const count = Array.isArray(result) ? result.length : 0;
          await prisma.dataset.update({
            where: { id: target.id }, data: { totalRecords: { decrement: count } }
          });
          return NextResponse.json({ type: 'DELETE', affected: count, preview: false });
        }
      }
    } catch (err: any) {
      return NextResponse.json({ message: err.message || 'Query execution failed' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
