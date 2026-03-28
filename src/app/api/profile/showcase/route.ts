import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getShowcaseCards, setShowcaseCard, removeShowcaseCard, swapShowcasePositions } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ showcase: getShowcaseCards(user.id) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { user_card_id?: number; position?: number };
  if (!body.user_card_id || !body.position) {
    return NextResponse.json({ error: 'user_card_id and position are required' }, { status: 400 });
  }

  try {
    setShowcaseCard(user.id, body.user_card_id, body.position);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { from_position?: number; to_position?: number };
  if (!body.from_position || !body.to_position) {
    return NextResponse.json({ error: 'from_position and to_position are required' }, { status: 400 });
  }

  try {
    swapShowcasePositions(user.id, body.from_position, body.to_position);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { position?: number };
  if (!body.position) return NextResponse.json({ error: 'position is required' }, { status: 400 });

  removeShowcaseCard(user.id, body.position);
  return NextResponse.json({ success: true });
}
