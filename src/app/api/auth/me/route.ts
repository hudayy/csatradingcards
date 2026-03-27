import { NextResponse } from 'next/server';
import { getSession, COOKIE_NAME } from '@/lib/auth';
import { getUserByDiscordId, getUserCollectionStats, getTotalCardsAllUsers, isAdmin, isSuperAdmin, SUPER_ADMIN_CSA_ID } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const stats = getUserCollectionStats(user.id);
  const globalTotal = getTotalCardsAllUsers();

  return NextResponse.json({
    user: {
      id: user.id,
      discord_id: user.discord_id,
      discord_username: user.discord_username,
      avatar_url: user.avatar_url,
      csa_id: user.csa_id,
      csa_name: user.csa_name,
      coins: user.coins,
      is_admin: isAdmin(user),
      is_super_admin: isSuperAdmin(user),
    },
    stats: { ...stats, globalTotal },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
