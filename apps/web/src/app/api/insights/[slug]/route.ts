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
    return NextResponse.json(dataset.insights);
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
