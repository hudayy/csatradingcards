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
    const { receiver_id, my_card_ids, their_card_ids, my_coins = 0, their_coins = 0 } = body;

    if (!receiver_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const senderCardIds = Array.isArray(my_card_ids) ? my_card_ids : [];
    const receiverCardIds = Array.isArray(their_card_ids) ? their_card_ids : [];
    const senderCoins = Math.max(0, parseInt(my_coins) || 0);
    const receiverCoins = Math.max(0, parseInt(their_coins) || 0);

    const tradeId = createTrade(user.id, receiver_id, senderCardIds, receiverCardIds, senderCoins, receiverCoins);
    return NextResponse.json({ success: true, trade_id: tradeId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
