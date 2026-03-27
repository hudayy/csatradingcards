import { NextResponse } from 'next/server';
import { getSeasons } from '@/lib/csa-api';
import { getPlayerPool, getGMPool, generateCard, type Rarity } from '@/lib/cards';
import { getFeaturedCards } from '@/lib/db';

export async function GET() {
  try {
    const featured = getFeaturedCards();
    const [seasons, pool, gmPool] = await Promise.all([getSeasons(), getPlayerPool(), getGMPool()]);

    const latestSeason = seasons.sort((a, b) => b.number - a.number)[0];
    if (!latestSeason) {
      return NextResponse.json({ error: 'No seasons found' }, { status: 404 });
    }

    const gmByCsaId = new Map(gmPool.map(gm => [gm.gm_csa_id, gm]));

    const cards = [];
    for (const { csa_id, rarity } of featured) {
      const gm = gmByCsaId.get(csa_id);
      if (gm) {
        cards.push(gm);
        continue;
      }
      const entry = pool.find(p => p.player.Player.csa_id === csa_id);
      if (!entry) continue;
      const card = await generateCard(entry, rarity as Rarity, { id: latestSeason.id, number: latestSeason.number });
      cards.push(card);
    }

    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Featured cards error:', err);
    return NextResponse.json({ error: 'Failed to load featured cards' }, { status: 500 });
  }
}
