import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { exportCsv } from '@/lib/export';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const excludeDuplicates = request.nextUrl.searchParams.get('excludeDuplicates') === 'true';
    const csv = await exportCsv(id, excludeDuplicates);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="insightflow-export.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Export failed' }, { status: 400 });
  }
}
