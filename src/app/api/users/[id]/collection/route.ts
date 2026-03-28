import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getUserCards } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });

  const user = getUserById(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const rarity = searchParams.get('rarity') || undefined;
  const search = searchParams.get('search') || undefined;
  const sort = (searchParams.get('sort') || 'rarity') as 'rarity' | 'name_asc' | 'name_desc' | 'newest' | 'oldest';
  const cardType = (searchParams.get('card_type') || undefined) as 'player' | 'gm' | undefined;

  const cards = getUserCards(userId, { rarity, search, sort, cardType });
  return NextResponse.json({
    cards,
    user: { id: user.id, discord_username: user.discord_username, csa_name: user.csa_name, avatar_url: user.avatar_url },
  });
}
