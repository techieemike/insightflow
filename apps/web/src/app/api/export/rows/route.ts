import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { exportRows } from '@/lib/export';

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const { format, columns, rows } = await request.json() as { format: 'csv' | 'excel'; columns: string[]; rows: Record<string, unknown>[] };

    if (!format || !columns || !rows) {
      return NextResponse.json({ message: 'format, columns, and rows are required' }, { status: 400 });
    }

    const result = await exportRows(columns, rows, format);

    if (format === 'csv') {
      return new NextResponse(result as string, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="query-results.csv"',
        },
      });
    }

    return new NextResponse(result as unknown as BodyInit | null, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="query-results.xlsx"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
