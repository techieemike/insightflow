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
    const { content, ...rest } = dataset;
    const contentPreview = dataset.type === 'document' && content ? (content as string).slice(0, 1000) : undefined;
    return NextResponse.json({ ...rest, contentPreview });
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    requireAuth(request);
    const { slug } = await params;
    const dataset = await prisma.dataset.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
    });
    if (!dataset) {
      return NextResponse.json({ message: 'Dataset not found' }, { status: 404 });
    }
    await prisma.dataset.delete({ where: { id: dataset.id } });
    return NextResponse.json({ message: 'Dataset deleted', id: dataset.id });
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
