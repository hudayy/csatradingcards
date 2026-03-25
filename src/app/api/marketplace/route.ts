import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByDiscordId, getActiveListings, createListing, getUserCardById, getActiveListingByUserCardId, cancelListing } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const filters = {
    rarity: url.searchParams.get('rarity') || undefined,
    franchiseId: url.searchParams.get('franchise_id') ? parseInt(url.searchParams.get('franchise_id')!) : undefined,
    minPrice: url.searchParams.get('min_price') ? parseInt(url.searchParams.get('min_price')!) : undefined,
    maxPrice: url.searchParams.get('max_price') ? parseInt(url.searchParams.get('max_price')!) : undefined,
    search: url.searchParams.get('search') || undefined,
  };

  const listings = getActiveListings(filters);
  return NextResponse.json({ listings, total: listings.length });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await req.json();
  const { user_card_id, price } = body;

  if (!user_card_id || !price || price < 1) {
    return NextResponse.json({ error: 'Invalid listing data' }, { status: 400 });
  }

  // Verify ownership
  const userCard = getUserCardById(user_card_id);
  if (!userCard || userCard.user_id !== user.id) {
    return NextResponse.json({ error: 'Card not found in your collection' }, { status: 404 });
  }

  if (userCard.is_listed) {
    return NextResponse.json({ error: 'Card is already listed' }, { status: 400 });
  }

  const listingId = createListing(user.id, user_card_id, userCard.card_id, price);

  return NextResponse.json({ listing_id: listingId, success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = getUserByDiscordId(session.discord_id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await req.json();
  const { user_card_id } = body;

  if (!user_card_id) {
    return NextResponse.json({ error: 'Missing user_card_id' }, { status: 400 });
  }

  const listing = getActiveListingByUserCardId(user_card_id);
  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const cancelled = cancelListing(listing.id, user.id);
  if (!cancelled) {
    return NextResponse.json({ error: 'Failed to cancel listing' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
