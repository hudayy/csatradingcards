import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchUsers, getUserByDiscordId } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q') || '';
  if (!q.trim()) {
    return NextResponse.json({ users: [] });
  }

  const currentUser = getUserByDiscordId(session.discord_id);
  const results = searchUsers(q, 20);

  const users = results
    .filter(u => u.id !== currentUser?.id)
    .map(u => ({
      id: u.id,
      csa_id: u.csa_id,
      csa_name: u.csa_name,
      discord_username: u.discord_username,
      avatar_url: u.avatar_url,
    }));

  return NextResponse.json({ users });
}
