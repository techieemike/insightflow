import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    requireAuth(request);
    const { slug, id: recordId } = await params;
    const dataset = await prisma.dataset.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
    });
    if (!dataset) {
      return NextResponse.json({ message: 'Dataset not found' }, { status: 404 });
    }

    const { data } = await request.json();
    const existing = await prisma.dataRecord.findFirst({
      where: { id: recordId, datasetId: dataset.id }
    });
    if (!existing) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 });
    }

    const updated = { ...(existing.data as any), ...data };
    const result = await prisma.dataRecord.update({
      where: { id: recordId },
      data: { data: updated }
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
