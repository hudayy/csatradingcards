import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getUserById, getPacksOpenedToday, incrementPacksOpened, createPack, addCardToUser, addCardToPack, isAdmin, updateCoins, recordCoinTransaction, consumeInventoryPack, getInventoryPackType, incrementChallengeProgress, getFranchiseLoyaltyRotation } from '@/lib/db';
import { generatePackCards, PACK_CONFIGS, type PackType } from '@/lib/cards';

const DAILY_FREE_PACKS = parseInt(process.env.DAILY_FREE_PACKS || '3', 10);
const CARDS_PER_PACK = parseInt(process.env.CARDS_PER_PACK || '5', 10);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const isDevMode = request.nextUrl.searchParams.get('dev') === '1' && isAdmin(user);
  const body = await request.json().catch(() => ({})) as { pack_type?: string; paid?: boolean; inventory_id?: number };

  // --- Inventory pack ---
  if (body.inventory_id != null) {
    // Peek at pack type first — don't consume until cards are successfully generated
    const packType = getInventoryPackType(user.id, body.inventory_id);
    if (!packType) return NextResponse.json({ error: 'Pack not found in your inventory' }, { status: 404 });

    const loyaltyFranchiseId = packType === 'franchise_loyalty' ? getFranchiseLoyaltyRotation()?.franchise_id : undefined;
    let cards;
    try {
      cards = await generatePackCards(CARDS_PER_PACK, packType as PackType, loyaltyFranchiseId);
    } catch (error) {
      console.error('Pack opening error:', error);
      // Pack not consumed yet — user can try again
      return NextResponse.json({ error: 'Failed to generate pack. The CSA API may be temporarily unavailable.' }, { status: 500 });
    }

    // Cards generated — now atomically consume the pack
    const consumed = consumeInventoryPack(user.id, body.inventory_id);
    if (!consumed) return NextResponse.json({ error: 'Pack no longer available' }, { status: 409 });

    const packId = createPack(user.id, packType);
    const userCards = cards.map(card => {
      const userCardId = addCardToUser(user.id, card.id, 'pack');
      addCardToPack(packId, card.id, userCardId);
      return { ...card, user_card_id: userCardId };
    });
    incrementChallengeProgress(user.id, 'daily_open_pack');
    incrementChallengeProgress(user.id, 'daily_open_3_packs');
    incrementChallengeProgress(user.id, 'weekly_open_10_packs');
    if (packType === 'elite') incrementChallengeProgress(user.id, 'weekly_open_elite_pack');
    const updatedUser = getUserById(user.id)!;
    return NextResponse.json({ pack_id: packId, cards: userCards, new_balance: updatedUser.coins });
  }

  // --- Paid or free pack ---
  const packType = (body.pack_type as PackType) || 'standard';
  const isPaid = body.paid === true;

  if (!PACK_CONFIGS[packType]) return NextResponse.json({ error: 'Invalid pack type' }, { status: 400 });

  if (isPaid) {
    const cost = PACK_CONFIGS[packType].cost;
    if (user.coins < cost) {
      return NextResponse.json({ error: `Not enough coins. Need ${cost.toLocaleString()}, you have ${user.coins.toLocaleString()}` }, { status: 400 });
    }
  } else {
    const packsToday = isDevMode ? 0 : getPacksOpenedToday(user.id);
    if (!isDevMode && packsToday >= DAILY_FREE_PACKS) {
      return NextResponse.json({ error: 'No free packs remaining today', packs_remaining: 0, reset_at: getResetTime() }, { status: 429 });
    }
  }

  try {
    // Generate cards first — if the CSA API fails, no coins are deducted
    const loyaltyFranchiseId = packType === 'franchise_loyalty' ? getFranchiseLoyaltyRotation()?.franchise_id : undefined;
    const cards = await generatePackCards(CARDS_PER_PACK, packType, loyaltyFranchiseId);

    if (isPaid) updateCoins(user.id, -PACK_CONFIGS[packType].cost);

    const packId = createPack(user.id, packType);

    const userCards = cards.map(card => {
      const userCardId = addCardToUser(user.id, card.id, 'pack');
      addCardToPack(packId, card.id, userCardId);
      return { ...card, user_card_id: userCardId };
    });

    if (!isPaid && !isDevMode) incrementPacksOpened(user.id);

    // Challenge progress
    if (!isDevMode) {
      incrementChallengeProgress(user.id, 'daily_open_pack');
      incrementChallengeProgress(user.id, 'daily_open_3_packs');
      incrementChallengeProgress(user.id, 'weekly_open_10_packs');
      if (packType === 'elite') incrementChallengeProgress(user.id, 'weekly_open_elite_pack');
    }

    const updatedUser = getUserById(user.id)!;

    if (isPaid) {
      recordCoinTransaction(user.id, -PACK_CONFIGS[packType].cost, updatedUser.coins, 'pack_purchase', `Purchased ${PACK_CONFIGS[packType].name}`);
    }

    const packsToday = isDevMode ? 0 : getPacksOpenedToday(user.id);

    return NextResponse.json({
      pack_id: packId,
      cards: userCards,
      packs_remaining: isDevMode ? 9999 : DAILY_FREE_PACKS - packsToday,
      reset_at: getResetTime(),
      dev_mode: isDevMode,
      new_balance: updatedUser.coins,
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
