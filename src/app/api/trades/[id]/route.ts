import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, acceptTrade, declineTrade, cancelTrade, incrementChallengeProgress } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;
  const tradeId = parseInt(id);
  if (isNaN(tradeId)) {
    return NextResponse.json({ error: 'Invalid trade id' }, { status: 400 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === 'accept') {
    const result = acceptTrade(tradeId, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    incrementChallengeProgress(user.id, 'weekly_complete_trade');
    return NextResponse.json({ success: true });
  } else if (action === 'decline') {
    const ok = declineTrade(tradeId, user.id);
    if (!ok) {
      return NextResponse.json({ error: 'Could not decline trade' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { id } = await params;
  const tradeId = parseInt(id);
  if (isNaN(tradeId)) {
    return NextResponse.json({ error: 'Invalid trade id' }, { status: 400 });
  }

  const ok = cancelTrade(tradeId, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'Could not cancel trade' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
