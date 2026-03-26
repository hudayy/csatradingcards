import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, salvageCard } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { user_card_id } = await req.json();
  if (!user_card_id) return NextResponse.json({ error: 'Missing user_card_id' }, { status: 400 });

  try {
    const result = salvageCard(user.id, user_card_id);
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to salvage' }, { status: 400 });
  }
}
