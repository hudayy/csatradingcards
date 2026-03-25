import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
  });

  const state = req.nextUrl.searchParams.get('redirect') || '/';

  params.set('state', state);

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
