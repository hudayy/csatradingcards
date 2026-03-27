import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getUserCards, getCollectionRarityCounts } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const url = req.nextUrl;
  const filters = {
    rarity: url.searchParams.get('rarity') || undefined,
    franchiseId: url.searchParams.get('franchise_id') ? parseInt(url.searchParams.get('franchise_id')!) : undefined,
    seasonId: url.searchParams.get('season_id') ? parseInt(url.searchParams.get('season_id')!) : undefined,
    tierAbbr: url.searchParams.get('tier') || undefined,
    search: url.searchParams.get('search') || undefined,
    sort: (url.searchParams.get('sort') || undefined) as 'rarity' | 'name_asc' | 'name_desc' | 'newest' | 'oldest' | undefined,
    cardType: (url.searchParams.get('card_type') || undefined) as 'player' | 'gm' | undefined,
  };

  const cards = getUserCards(user.id, filters);
  const rarityCounts = getCollectionRarityCounts(user.id);
  const totalCards = rarityCounts.reduce((s, r) => s + r.count, 0);

  return NextResponse.json({ cards, total: cards.length, rarityCounts, totalCards });
}
