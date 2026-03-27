import { NextResponse } from 'next/server';
import { getFeaturedCardsWithData } from '@/lib/db';

export async function GET() {
  try {
    const cards = getFeaturedCardsWithData();
    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Featured cards error:', err);
    return NextResponse.json({ error: 'Failed to load featured cards' }, { status: 500 });
  }
}
