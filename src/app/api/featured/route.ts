import { NextResponse } from 'next/server';
import { getSeasons } from '@/lib/csa-api';
import { getPlayerPool, generateCard, type Rarity } from '@/lib/cards';

const FEATURED: { csaId: number; rarity: Rarity }[] = [
  { csaId: 420, rarity: 'gold' },
  { csaId: 121, rarity: 'prismatic' },
  { csaId: 314, rarity: 'bronze' },
];

export async function GET() {
  try {
    const [seasons, pool] = await Promise.all([getSeasons(), getPlayerPool()]);

    const season3 = seasons.find(s => s.number === 3);
    if (!season3) {
      return NextResponse.json({ error: 'Season 3 not found' }, { status: 404 });
    }

    const cards = [];
    for (const { csaId, rarity } of FEATURED) {
      const entry = pool.find(p => p.player.Player.csa_id === csaId);
      if (!entry) continue;
      const card = await generateCard(entry, rarity, { id: season3.id, number: season3.number });
      cards.push(card);
    }

    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Featured cards error:', err);
    return NextResponse.json({ error: 'Failed to load featured cards' }, { status: 500 });
  }
}
