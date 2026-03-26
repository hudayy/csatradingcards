import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getPacksOpenedToday, incrementPacksOpened, createPack, addCardToUser, addCardToPack, isAdmin } from '@/lib/db';
import { generatePackCards } from '@/lib/cards';

const DAILY_FREE_PACKS = parseInt(process.env.DAILY_FREE_PACKS || '3', 10);
const CARDS_PER_PACK = parseInt(process.env.CARDS_PER_PACK || '5', 10);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Dev/admin mode: bypass daily limit for admins
  const isDevMode = request.nextUrl.searchParams.get('dev') === '1' && isAdmin(user);

  // Check daily limit (skipped in dev mode)
  const packsToday = isDevMode ? 0 : getPacksOpenedToday(user.id);
  if (!isDevMode && packsToday >= DAILY_FREE_PACKS) {
    return NextResponse.json({
      error: 'No free packs remaining today',
      packs_remaining: 0,
      reset_at: getResetTime(),
    }, { status: 429 });
  }

  try {
    // Generate cards
    const cards = await generatePackCards(CARDS_PER_PACK);

    // Create pack record
    const packId = createPack(user.id, 'standard');

    // Add cards to user and pack
    const userCards = cards.map(card => {
      const userCardId = addCardToUser(user.id, card.id, 'pack');
      addCardToPack(packId, card.id, userCardId);
      return { ...card, user_card_id: userCardId };
    });

    // Increment packs opened (skipped in dev mode)
    if (!isDevMode) {
      incrementPacksOpened(user.id);
    }

    return NextResponse.json({
      pack_id: packId,
      cards: userCards,
      packs_remaining: isDevMode ? 9999 : DAILY_FREE_PACKS - packsToday - 1,
      reset_at: getResetTime(),
      dev_mode: isDevMode,
    });
  } catch (error) {
    console.error('Pack opening error:', error);
    return NextResponse.json({ error: 'Failed to generate pack. The CSA API may be temporarily unavailable.' }, { status: 500 });
  }
}

function getResetTime(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}
