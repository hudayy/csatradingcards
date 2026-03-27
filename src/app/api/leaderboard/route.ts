import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export async function GET() {
  try {
    const leaderboard = getLeaderboard(100);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
