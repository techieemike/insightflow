import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

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

    const { action, params: actionParams } = await request.json() as { action: string; params?: any };
    const records = await prisma.dataRecord.findMany({
      where: { datasetId: id }
    });
    const columns = dataset.columns as string[];

    switch (action) {
      case 'removeDuplicates': {
        const dupIds = records.filter(r => r.isDuplicate).map(r => r.id);
        if (dupIds.length > 0) {
          await prisma.dataRecord.deleteMany({ where: { id: { in: dupIds } } });
        }
        const remaining = await prisma.dataRecord.count({ where: { datasetId: id } });
        await prisma.dataset.update({
          where: { id }, data: { totalRecords: remaining, duplicateCount: 0 }
        });
        return NextResponse.json({ removed: dupIds.length, remaining });
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
            await prisma.dataRecord.update({
              where: { id: record.id }, data: { data: row }
            });
            filled++;
          }
        }
        return NextResponse.json({ filled });
      }
      case 'dropColumn': {
        const col = actionParams?.column;
        if (!col || !columns.includes(col)) {
          return NextResponse.json({ message: 'Column not found' }, { status: 404 });
        }
        for (const record of records) {
          const row = record.data as any;
          delete row[col];
          await prisma.dataRecord.update({
            where: { id: record.id }, data: { data: row }
          });
        }
        const newColumns = columns.filter(c => c !== col);
        await prisma.dataset.update({
          where: { id }, data: { columns: newColumns }
        });
        return NextResponse.json({ dropped: col, columns: newColumns });
      }
      case 'renameColumn': {
        const from = actionParams?.from;
        const to = actionParams?.to;
        if (!from || !to || !columns.includes(from)) {
          return NextResponse.json({ message: 'Column not found' }, { status: 404 });
        }
        for (const record of records) {
          const row = record.data as any;
          row[to] = row[from];
          delete row[from];
          await prisma.dataRecord.update({
            where: { id: record.id }, data: { data: row }
          });
        }
        const newColumns = columns.map(c => c === from ? to : c);
        await prisma.dataset.update({
          where: { id }, data: { columns: newColumns }
        });
        return NextResponse.json({ renamed: { from, to }, columns: newColumns });
      }
      default:
        return NextResponse.json({ message: 'Unknown action: ' + action }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
