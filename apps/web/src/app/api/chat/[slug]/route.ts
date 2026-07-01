import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { chat, getHistory } from '@/lib/chat';

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

    const { question } = await request.json();
    if (!question || !question.trim()) {
      return NextResponse.json({ message: 'Question is required' }, { status: 400 });
    }

    const result = await chat(dataset.id, question);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Chat failed' }, { status: 400 });
  }
}

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

    const history = await getHistory(dataset.id);
    return NextResponse.json(history);
  } catch (err: any) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
