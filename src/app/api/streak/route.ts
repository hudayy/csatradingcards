import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STREAK_MILESTONES: Record<number, { coins: number; pack?: string; guaranteed_rarity?: string }> = {
  3:   { coins: 200 },
  7:   { coins: 0, guaranteed_rarity: 'diamond' },
  14:  { coins: 0, pack: 'elite' },
  30:  { coins: 1000, pack: 'apex' },
  100: { coins: 2000, pack: 'apex' },
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const today = new Date().toISOString().split('T')[0];
  const streak = user.login_streak ?? 0;
  const claimedToday = user.last_daily_bonus === today;

  // Find next milestone
  const milestoneKeys = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestoneKeys.find(m => m > streak) ?? null;

  return NextResponse.json({
    streak,
    claimed_today: claimedToday,
    next_milestone: nextMilestone,
    next_milestone_reward: nextMilestone ? STREAK_MILESTONES[nextMilestone] : null,
    milestones: STREAK_MILESTONES,
  });
}
