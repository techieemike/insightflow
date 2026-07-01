import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    const records = await prisma.dataRecord.findMany({
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
          charts.push({ type: 'bar', title: `${numCol} by ${catCol}`, dataKey: 'sum', data: sorted });
          charts.push({ type: 'pie', title: `${numCol} distribution by ${catCol}`, dataKey: 'sum', data: sorted });
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
          charts.push({ type: 'line', title: `${numCol} over ${dateCol}`, dataKey: 'value', data: sorted });
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

    return NextResponse.json({ charts, catCols, numCols, dateCols });
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
