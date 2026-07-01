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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const showDuplicates = searchParams.get('showDuplicates') === 'true';
    const column = searchParams.get('column') || undefined;
    const value = searchParams.get('value') || undefined;
    const equalsCol = searchParams.get('equalsCol') || undefined;
    const equalsVal = searchParams.get('equalsVal') || undefined;
    const minCol = searchParams.get('minCol') || undefined;
    const minVal = searchParams.get('minVal') || undefined;
    const maxCol = searchParams.get('maxCol') || undefined;
    const maxVal = searchParams.get('maxVal') || undefined;
    const dateFromCol = searchParams.get('dateFromCol') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateToCol = searchParams.get('dateToCol') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const where: any = { datasetId: id };
    if (!showDuplicates) where.isDuplicate = false;
    if (column && value) {
      where.data = { path: [column], string_contains: value };
    }

    const hasJsFilters = !!(equalsCol || minCol || maxCol || dateFromCol || dateToCol);

    if (hasJsFilters) {
      const all = await prisma.dataRecord.findMany({
        where, orderBy: { rowIndex: 'asc' }
      });
      const allRows: Record<string, unknown>[] = all.map(r => ({ ...(r.data as Record<string, unknown>), __isDuplicate: r.isDuplicate, __id: r.id }));
      let rows = allRows;
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
      return NextResponse.json({ records: rows, total, page, limit, pages: Math.ceil(total / limit) });
    }

    const [records, total] = await Promise.all([
      prisma.dataRecord.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { rowIndex: 'asc' }
      }),
      prisma.dataRecord.count({ where })
    ]);
    return NextResponse.json({
      records: records.map(r => ({ ...(r.data as Record<string, unknown>), __isDuplicate: r.isDuplicate, __id: r.id })),
      total, page, limit, pages: Math.ceil(total / limit)
    });
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
