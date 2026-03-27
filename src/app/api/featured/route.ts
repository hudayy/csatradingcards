import { NextResponse } from 'next/server';
import { getSeasons } from '@/lib/csa-api';
import { getPlayerPool, getGMPool, generateCard, type Rarity } from '@/lib/cards';

const FEATURED: { csaId: number; rarity: Rarity }[] = [
  { csaId: 420, rarity: 'gold' },
  { csaId: 121, rarity: 'prismatic' },
  { csaId: 314, rarity: 'bronze' },
];

export async function GET() {
  try {
    const [seasons, pool, gmPool] = await Promise.all([getSeasons(), getPlayerPool(), getGMPool()]);

    const season3 = seasons.find(s => s.number === 3);
    if (!season3) {
      return NextResponse.json({ error: 'Season 3 not found' }, { status: 404 });
    }

    const gmByCsaId = new Map(gmPool.map(gm => [gm.gm_csa_id, gm]));

    const cards = [];
    for (const { csaId, rarity } of FEATURED) {
      const gm = gmByCsaId.get(csaId);
      if (gm) {
        cards.push(gm);
        continue;
      }
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
