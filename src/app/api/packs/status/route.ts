import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getPacksOpenedToday } from '@/lib/db';

const DAILY_FREE_PACKS = parseInt(process.env.DAILY_FREE_PACKS || '3', 10);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const packsToday = getPacksOpenedToday(user.id);

  return NextResponse.json({
    packs_remaining: Math.max(0, DAILY_FREE_PACKS - packsToday),
    packs_opened_today: packsToday,
    daily_limit: DAILY_FREE_PACKS,
  });
}
