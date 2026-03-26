import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, salvageCard, bulkSalvageCards } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();

  // Bulk salvage
  if (Array.isArray(body.user_card_ids)) {
    if (body.user_card_ids.length === 0) return NextResponse.json({ error: 'No cards selected' }, { status: 400 });
    try {
      const result = bulkSalvageCards(user.id, body.user_card_ids);
      return NextResponse.json({ success: true, coins: result.totalCoins, new_balance: result.newBalance, count: result.count });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to salvage' }, { status: 400 });
    }
  }

  // Single salvage
  const { user_card_id } = body;
  if (!user_card_id) return NextResponse.json({ error: 'Missing user_card_id' }, { status: 400 });

  try {
    const result = salvageCard(user.id, user_card_id);
    return NextResponse.json({ success: true, ...result, new_balance: result.newBalance });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to salvage' }, { status: 400 });
  }
}
