import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, bulkCreateListings } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { items?: { user_card_id: number; price: number }[] };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
  }
  if (body.items.length > 50) {
    return NextResponse.json({ error: 'Cannot bulk list more than 50 cards at once' }, { status: 400 });
  }

  const result = bulkCreateListings(user.id, body.items);
  return NextResponse.json({ success: true, ...result });
}
