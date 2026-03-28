import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getSetStatuses, claimSetReward } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const sets = getSetStatuses(user.id);
  return NextResponse.json({ sets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const { set_type, franchise_id, rarity, season_id } = await req.json();
    if (!set_type || !franchise_id || !season_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const result = claimSetReward(user.id, set_type, franchise_id, rarity ?? null, season_id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
