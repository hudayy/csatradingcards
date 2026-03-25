import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getTradesForUser, createTrade } from '@/lib/db';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const trades = getTradesForUser(user.id);
  return NextResponse.json({ trades });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { receiver_id, my_card_ids, their_card_ids } = body;

    if (!receiver_id || !Array.isArray(my_card_ids) || !Array.isArray(their_card_ids) || !my_card_ids.length || !their_card_ids.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tradeId = createTrade(user.id, receiver_id, my_card_ids, their_card_ids);
    return NextResponse.json({ success: true, trade_id: tradeId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
