import { NextResponse } from 'next/server';
import { getFranchiseLoyaltyRotation } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rotation = getFranchiseLoyaltyRotation();
  if (!rotation) {
    return NextResponse.json({ error: 'No franchises available' }, { status: 503 });
  }
  return NextResponse.json(rotation);
}
