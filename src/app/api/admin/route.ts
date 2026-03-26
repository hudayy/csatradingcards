import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getUserByDiscordId, getUserById, isAdmin, isSuperAdmin,
  setAdminStatus, getSystemStats, getAllUsers, adminSetCoins,
  adminCancelListing, adminCancelTrade, adminGetAllListings,
  adminGetAllTrades, adminRemoveCard, getUserCards, searchUsers,
} from '@/lib/db';

async function getAdminUser(requiredSuperAdmin = false) {
  const session = await getSession();
  if (!session) return null;
  const user = getUserByDiscordId(session.discord_id);
  if (!user) return null;
  if (requiredSuperAdmin && !isSuperAdmin(user)) return null;
  if (!isAdmin(user)) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const action = req.nextUrl.searchParams.get('action');

  if (action === 'stats') {
    return NextResponse.json(getSystemStats());
  }
  if (action === 'users') {
    const search = req.nextUrl.searchParams.get('q') || undefined;
    return NextResponse.json({ users: getAllUsers(search) });
  }
  if (action === 'listings') {
    return NextResponse.json({ listings: adminGetAllListings() });
  }
  if (action === 'trades') {
    return NextResponse.json({ trades: adminGetAllTrades() });
  }
  if (action === 'user_cards') {
    const userId = parseInt(req.nextUrl.searchParams.get('user_id') || '');
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
    return NextResponse.json({ cards: getUserCards(userId) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Super-admin-only actions
  if (action === 'set_admin') {
    const admin = await getAdminUser(true);
    if (!admin) return NextResponse.json({ error: 'Super admin required' }, { status: 403 });

    const { user_id, is_admin: makeAdmin } = body;
    const target = getUserById(user_id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (isSuperAdmin(target)) return NextResponse.json({ error: 'Cannot modify super admin' }, { status: 400 });

    setAdminStatus(user_id, !!makeAdmin);
    return NextResponse.json({ success: true });
  }

  // Regular admin actions
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  if (action === 'add_coins') {
    const { user_id, amount } = body;
    const amt = parseInt(amount);
    if (!user_id || isNaN(amt) || amt === 0 || Math.abs(amt) > 10_000_000) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const target = getUserById(user_id);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const newBalance = adminSetCoins(user_id, amt);
    return NextResponse.json({ success: true, new_balance: newBalance });
  }

  if (action === 'add_coins_self') {
    const amount = parseInt(body.amount);
    if (!amount || isNaN(amount) || amount < 1 || amount > 10_000_000) {
      return NextResponse.json({ error: 'Invalid amount (1–10,000,000)' }, { status: 400 });
    }
    const newBalance = adminSetCoins(admin.id, amount);
    return NextResponse.json({ success: true, new_balance: newBalance });
  }

  if (action === 'cancel_listing') {
    const { listing_id } = body;
    const ok = adminCancelListing(listing_id);
    if (!ok) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'cancel_trade') {
    const { trade_id } = body;
    const ok = adminCancelTrade(trade_id);
    if (!ok) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_card') {
    const { user_card_id } = body;
    const ok = adminRemoveCard(user_card_id);
    if (!ok) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === 'search_users') {
    const { query } = body;
    return NextResponse.json({ users: searchUsers(query || '') });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
