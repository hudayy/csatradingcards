import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getUserByDiscordId, type User } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const COOKIE_NAME = 'csa_tc_session';

export interface SessionPayload {
  discord_id: string;
  discord_username: string;
  avatar_url: string | null;
  csa_id: number | null;
  csa_name: string | null;
  user_id: number;
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return getUserByDiscordId(session.discord_id) ?? null;
}

export async function requireAuth(): Promise<User> {
  const user = await getUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export { COOKIE_NAME };
