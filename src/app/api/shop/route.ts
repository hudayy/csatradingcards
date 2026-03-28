import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getActiveShopSlots, purchaseShopSlot, seedShopRotation } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  seedShopRotation();
  const slots = getActiveShopSlots();
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    const { slot_id } = await req.json();
    if (!slot_id) return NextResponse.json({ error: 'Missing slot_id' }, { status: 400 });
    const result = purchaseShopSlot(user.id, slot_id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
