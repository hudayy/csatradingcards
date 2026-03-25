import { NextResponse } from 'next/server';
import { getSession, COOKIE_NAME } from '@/lib/auth';
import { getUserByDiscordId, getUserCollectionStats } from '@/lib/db';

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

  return NextResponse.json({
    user: {
      id: user.id,
      discord_id: user.discord_id,
      discord_username: user.discord_username,
      avatar_url: user.avatar_url,
      csa_id: user.csa_id,
      csa_name: user.csa_name,
      coins: user.coins,
    },
    stats,
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
