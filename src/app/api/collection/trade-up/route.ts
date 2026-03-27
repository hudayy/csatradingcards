import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, consumeCardsForTradeUp, addCardToUser, insertCard } from '@/lib/db';
import { getPlayerPool, generateCard, type Rarity } from '@/lib/cards';

const RARITY_UPGRADE: Record<string, Rarity> = {
  bronze: 'silver', silver: 'gold', gold: 'platinum',
  platinum: 'diamond', diamond: 'holographic', holographic: 'prismatic',
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { user_card_ids?: number[] };
  if (!Array.isArray(body.user_card_ids) || body.user_card_ids.length !== 5) {
    return NextResponse.json({ error: 'Must select exactly 5 cards' }, { status: 400 });
  }

  let inputRarity: string;
  try {
    inputRarity = consumeCardsForTradeUp(user.id, body.user_card_ids);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const targetRarity = RARITY_UPGRADE[inputRarity];
  if (!targetRarity) {
    return NextResponse.json({ error: 'Prismatic cards cannot be traded up' }, { status: 400 });
  }

  try {
    const pool = await getPlayerPool();
    if (!pool.length) return NextResponse.json({ error: 'No players available' }, { status: 500 });

    const entry = pool[Math.floor(Math.random() * pool.length)];
    const card = await generateCard(entry, targetRarity);
    insertCard(card);
    const userCardId = addCardToUser(user.id, card.id, 'reward');

    return NextResponse.json({
      success: true,
      card: { ...card, user_card_id: userCardId },
      traded_rarity: inputRarity,
      received_rarity: targetRarity,
    });
  } catch (error) {
    console.error('Trade-up card generation error:', error);
    return NextResponse.json({ error: 'Failed to generate card. Try again.' }, { status: 500 });
  }
}
