import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getExtendedUserStats, getUserCollectionValue } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const user = getUserByDiscordId(session.discord_id);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const stats = getExtendedUserStats(user.id);
  const collection_value = getUserCollectionValue(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      discord_username: user.discord_username,
      csa_id: user.csa_id,
      csa_name: user.csa_name,
      avatar_url: user.avatar_url,
      coins: user.coins,
      created_at: user.created_at,
      last_login: user.last_login,
      collection_value,
      net_worth: user.coins + collection_value,
    },
    stats,
  });
}
