import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, COOKIE_NAME } from '@/lib/auth';
import { upsertUser } from '@/lib/db';
import { getMemberByDiscordId } from '@/lib/csa-api';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') || '/';
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=no_code`);
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl}/api/auth/callback`,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange`);
    }

    const tokenData = await tokenRes.json();

    // Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${baseUrl}/?error=user_fetch`);
    }

    const discordUser = await userRes.json();
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
      : null;

    // Look up CSA member
    const csaMember = await getMemberByDiscordId(discordUser.id);

    // Upsert user
    const user = upsertUser(
      discordUser.id,
      discordUser.username,
      avatarUrl,
      csaMember?.csa_id,
      csaMember?.csa_name
    );

    // Create session
    const token = createSessionToken({
      discord_id: discordUser.id,
      discord_username: discordUser.username,
      avatar_url: avatarUrl,
      csa_id: csaMember?.csa_id ?? null,
      csa_name: csaMember?.csa_name ?? null,
      user_id: user.id,
    });

    const response = NextResponse.redirect(`${baseUrl}${state}`);
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/?error=auth_failed`);
  }
}
