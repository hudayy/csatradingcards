import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getPendingIncomingTradeCount } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ count: 0 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ count: 0 });

  return NextResponse.json({ count: getPendingIncomingTradeCount(user.id) });
}
