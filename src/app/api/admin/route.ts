import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getUserById, updateCoins, recordCoinTransaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.csa_id !== 121) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.action === 'add_coins') {
    const amount = parseInt(body.amount);
    if (!amount || isNaN(amount) || amount < 1 || amount > 10_000_000) {
      return NextResponse.json({ error: 'Invalid amount (1 – 10,000,000)' }, { status: 400 });
    }
    updateCoins(user.id, amount);
    const updated = getUserById(user.id);
    recordCoinTransaction(user.id, amount, updated!.coins, 'reward', 'Admin: added coins');
    return NextResponse.json({ success: true, new_balance: updated!.coins });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
