import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getPackHistory, getPackInventory, grantDailyPrestigePacks } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  grantDailyPrestigePacks(user.id);

  return NextResponse.json({
    inventory: getPackInventory(user.id),
    packs: getPackHistory(user.id),
  });
}
