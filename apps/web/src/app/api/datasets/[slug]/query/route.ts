import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    requireAuth(request);
    const { slug } = await params;
    const dataset = await prisma.dataset.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
    });
    if (!dataset) {
      return NextResponse.json({ message: 'Dataset not found' }, { status: 404 });
    }
    const id = dataset.id;
    const columns = dataset.columns as string[];

    const { sql, confirm } = await request.json() as { sql: string; confirm?: boolean };
    if (!sql || !sql.trim()) {
      return NextResponse.json({ message: 'SQL query is required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9]+$/.test(id))
      return NextResponse.json({ message: 'Invalid dataset ID' }, { status: 400 });

    const upper = sql.trim().toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('DELETE FROM _DATA'))
      return NextResponse.json({ message: 'Only SELECT or DELETE FROM _data queries are allowed' }, { status: 400 });
    if (/INSERT|UPDATE|DELETE\s+FROM\s+(?!_DATA)|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|--|\/\*/i.test(upper))
      return NextResponse.json({ message: 'Statement type not allowed' }, { status: 400 });

    const sample = await prisma.dataRecord.findMany({
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
          const result = (await prisma.$queryRawUnsafe(full)) as { count: unknown }[];
          return NextResponse.json({ type: 'DELETE', affected: Number(result[0]?.count ?? 0), preview: true });
        } else {
          const full = `WITH ${cte} DELETE FROM "DataRecord" d USING _data WHERE d.id = _data.id${whereClause ? ` AND ${whereClause}` : ''} RETURNING d.id`;
          const result = await prisma.$queryRawUnsafe(full);
          const count = Array.isArray(result) ? result.length : 0;
          await prisma.dataset.update({
            where: { id }, data: { totalRecords: { decrement: count } }
          });
          return NextResponse.json({ type: 'DELETE', affected: count, preview: false });
        }
      } else {
        const q = sql.replace(/;\s*$/, '');
        const full = `WITH ${cte} ${q} LIMIT 1000`;
        const result = await prisma.$queryRawUnsafe(full);
        const rows = (Array.isArray(result) ? result : []).map(r => sanitizeRow(r as Record<string, unknown>));
        const resultColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return NextResponse.json({ type: 'SELECT', columns: resultColumns, rows, total: rows.length });
      }
    } catch (err: any) {
      return NextResponse.json({ message: err.message || 'Query execution failed' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
