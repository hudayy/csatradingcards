import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getUserCards } from '@/lib/db';

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
  };

  const cards = getUserCards(user.id, filters);

  return NextResponse.json({ cards, total: cards.length });
}
