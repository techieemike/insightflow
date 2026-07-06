import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const { email, password, name, accessCode } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ message: 'Email, password, and name are required' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9]+$/.test(password)) {
      return NextResponse.json({ message: 'Password must be alphanumeric' }, { status: 400 });
    }
    if (process.env.ACCESS_CODE && accessCode !== process.env.ACCESS_CODE) {
      return NextResponse.json({ message: 'Invalid access code' }, { status: 401 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
    });

    const token = signToken(user.id);
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Registration failed' }, { status: 500 });
  }
}
