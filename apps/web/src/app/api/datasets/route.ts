import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    const datasets = await prisma.dataset.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, slug: true, originalName: true, totalRecords: true,
        qualityScore: true, uploadedAt: true, status: true, type: true, mimeType: true }
    });
    return NextResponse.json(datasets);
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
