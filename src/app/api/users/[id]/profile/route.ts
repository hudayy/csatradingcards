import { NextRequest, NextResponse } from 'next/server';
import { getPublicUserProfile } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });

  const profile = getPublicUserProfile(userId);
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json(profile);
}
