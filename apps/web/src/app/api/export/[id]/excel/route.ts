import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { exportExcel } from '@/lib/export';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(request);
    const { id } = await params;
    const excludeDuplicates = request.nextUrl.searchParams.get('excludeDuplicates') === 'true';
    const buf = await exportExcel(id, excludeDuplicates);
    return new NextResponse(buf as unknown as BodyInit | null, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="insightflow-export.xlsx"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Export failed' }, { status: 400 });
  }
}
