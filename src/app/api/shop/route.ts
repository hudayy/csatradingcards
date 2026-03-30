import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getUserById, recordCoinTransaction, getDb } from '@/lib/db';
import { PACK_CONFIGS, type PackType } from '@/lib/pack-config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const body = await req.json();

    if (body.action === 'buy_pack') {
      const packType = body.pack_type as PackType;
      const quantity = Math.max(1, Math.min(10, parseInt(body.quantity) || 1));
      if (!PACK_CONFIGS[packType]) return NextResponse.json({ error: 'Invalid pack type' }, { status: 400 });
      const cost = PACK_CONFIGS[packType].cost * quantity;
      const db = getDb();
      // Atomic coin check + deduction inside transaction to prevent double-spend
      const txResult = db.transaction(() => {
        const row = db.prepare('SELECT coins FROM users WHERE id = ?').get(user.id) as { coins: number } | undefined;
        if (!row || row.coins < cost) return { ok: false as const };
        db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(cost, user.id);
        for (let i = 0; i < quantity; i++) {
          db.prepare('INSERT INTO pack_inventory (user_id, pack_type) VALUES (?, ?)').run(user.id, packType);
        }
        return { ok: true as const };
      })();
      if (!txResult.ok) return NextResponse.json({ error: `Not enough coins. Need ${cost.toLocaleString()} coins.` }, { status: 400 });
      const updated = getUserById(user.id)!;
      recordCoinTransaction(user.id, -cost, updated.coins, 'pack_purchase', `Bought ${quantity}x ${packType} pack${quantity > 1 ? 's' : ''}`);
      return NextResponse.json({ success: true, quantity, pack_type: packType, newBalance: updated.coins });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
