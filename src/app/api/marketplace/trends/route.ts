import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();

  // Average sale price per rarity over last 7 days vs previous 7 days
  const rarityTrends = db.prepare(`
    SELECT
      c.rarity,
      AVG(CASE WHEN ml.sold_at >= datetime('now', '-7 days') THEN ml.price END) as avg_7d,
      AVG(CASE WHEN ml.sold_at < datetime('now', '-7 days') AND ml.sold_at >= datetime('now', '-14 days') THEN ml.price END) as avg_prev_7d,
      COUNT(CASE WHEN ml.sold_at >= datetime('now', '-7 days') THEN 1 END) as sales_7d,
      COUNT(CASE WHEN ml.sold_at >= datetime('now', '-30 days') THEN 1 END) as sales_30d,
      AVG(CASE WHEN ml.sold_at >= datetime('now', '-30 days') THEN ml.price END) as avg_30d
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    WHERE ml.status = 'sold'
    GROUP BY c.rarity
  `).all() as {
    rarity: string;
    avg_7d: number | null;
    avg_prev_7d: number | null;
    sales_7d: number;
    sales_30d: number;
    avg_30d: number | null;
  }[];

  // Most sold cards in last 7 days
  const hotCards = db.prepare(`
    SELECT c.player_name, c.rarity, c.franchise_name, c.franchise_color, c.player_avatar_url,
      COUNT(*) as sales, AVG(ml.price) as avg_price, MAX(ml.sold_at) as last_sold
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    WHERE ml.status = 'sold' AND ml.sold_at >= datetime('now', '-7 days')
    GROUP BY ml.card_id
    ORDER BY sales DESC, avg_price DESC
    LIMIT 10
  `).all() as {
    player_name: string; rarity: string; franchise_name: string | null;
    franchise_color: string | null; player_avatar_url: string | null;
    sales: number; avg_price: number; last_sold: string;
  }[];

  // Recent sales (last 20 transactions)
  const recentSales = db.prepare(`
    SELECT c.player_name, c.rarity, c.franchise_name, c.franchise_color,
      ml.price, ml.sold_at,
      COALESCE(su.csa_name, su.discord_username) as seller,
      COALESCE(bu.csa_name, bu.discord_username) as buyer
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    JOIN users su ON ml.seller_id = su.id
    JOIN users bu ON ml.buyer_id = bu.id
    WHERE ml.status = 'sold'
    ORDER BY ml.sold_at DESC
    LIMIT 20
  `).all() as {
    player_name: string; rarity: string; franchise_name: string | null;
    franchise_color: string | null; price: number; sold_at: string;
    seller: string; buyer: string;
  }[];

  // Total marketplace volume (last 30 days)
  const volume = db.prepare(`
    SELECT
      SUM(CASE WHEN sold_at >= datetime('now', '-7 days') THEN price ELSE 0 END) as vol_7d,
      SUM(CASE WHEN sold_at >= datetime('now', '-30 days') THEN price ELSE 0 END) as vol_30d,
      COUNT(CASE WHEN sold_at >= datetime('now', '-7 days') THEN 1 END) as txns_7d,
      COUNT(CASE WHEN sold_at >= datetime('now', '-30 days') THEN 1 END) as txns_30d
    FROM marketplace_listings
    WHERE status = 'sold'
  `).get() as { vol_7d: number; vol_30d: number; txns_7d: number; txns_30d: number };

  // Add trend direction to rarity data
  const rarityWithTrend = rarityTrends.map(r => ({
    ...r,
    avg_7d: r.avg_7d ? Math.round(r.avg_7d) : null,
    avg_prev_7d: r.avg_prev_7d ? Math.round(r.avg_prev_7d) : null,
    avg_30d: r.avg_30d ? Math.round(r.avg_30d) : null,
    trend: r.avg_7d && r.avg_prev_7d
      ? r.avg_7d > r.avg_prev_7d * 1.05 ? 'up'
      : r.avg_7d < r.avg_prev_7d * 0.95 ? 'down' : 'stable'
      : 'stable',
    pct_change: r.avg_7d && r.avg_prev_7d
      ? Math.round(((r.avg_7d - r.avg_prev_7d) / r.avg_prev_7d) * 100)
      : null,
  }));

  return NextResponse.json({
    rarity_trends: rarityWithTrend,
    hot_cards: hotCards.map(c => ({ ...c, avg_price: Math.round(c.avg_price) })),
    recent_sales: recentSales,
    volume,
  });
}
