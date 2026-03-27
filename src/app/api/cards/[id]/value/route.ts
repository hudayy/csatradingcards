import { NextRequest, NextResponse } from 'next/server';
import { estimateCardValue } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing card ID' }, { status: 400 });
  const valuation = estimateCardValue(id);
  return NextResponse.json(valuation);
}
