'use client';

import { useEffect, useState } from 'react';
import TradingCard from '@/components/TradingCard';
import Link from 'next/link';

interface CardData {
  id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  tier_name: string | null;
  tier_abbr: string | null;
  rarity: string;
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  season_number: number;
}

const DEMO_CARDS: CardData[] = [
  {
    id: 'demo-1', player_name: 'Star Player', player_avatar_url: null,
    franchise_name: 'Pythons', franchise_abbr: 'PYT', tier_name: 'Premier', tier_abbr: 'P',
    rarity: 'prismatic', stat_gpg: 1.25, stat_apg: 0.84, stat_svpg: 1.42, stat_win_pct: 0.72,
    salary: 8500, overall_rating: 95, season_number: 10
  },
  {
    id: 'demo-2', player_name: 'Diamond Pro', player_avatar_url: null,
    franchise_name: 'Storm', franchise_abbr: 'STM', tier_name: 'Major', tier_abbr: 'M',
    rarity: 'diamond', stat_gpg: 0.98, stat_apg: 0.67, stat_svpg: 1.88, stat_win_pct: 0.65,
    salary: 6200, overall_rating: 82, season_number: 10
  },
  {
    id: 'demo-3', player_name: 'Gold Legend', player_avatar_url: null,
    franchise_name: 'Eagles', franchise_abbr: 'EGL', tier_name: 'AAA', tier_abbr: 'A',
    rarity: 'holographic', stat_gpg: 1.10, stat_apg: 0.72, stat_svpg: 1.15, stat_win_pct: 0.68,
    salary: 5800, overall_rating: 88, season_number: 10
  },
];

export default function HomePage() {
  const [user, setUser] = useState<{ coins: number } | null>(null);
  const [stats, setStats] = useState<{ total: number; uniquePlayers: number; byRarity: { rarity: string; count: number }[] } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(data.user);
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <h1 className="hero-title">
          <span className="highlight">CSA</span> Trading Cards
        </h1>
        <p className="hero-subtitle">
          Collect digital trading cards of your favorite CSA Rocket League players.
          Open packs daily, discover rare cards, and trade with the community.
        </p>
        <div className="hero-cta">
          {user ? (
            <>
              <Link href="/packs" className="btn btn-primary">🎴 Open Packs</Link>
              <Link href="/collection" className="btn btn-secondary">📁 My Collection</Link>
            </>
          ) : (
            <a href="/api/auth/discord" className="btn btn-primary">🎮 Login with Discord</a>
          )}
        </div>

        <div className="featured-cards">
          {DEMO_CARDS.map(card => (
            <TradingCard key={card.id} card={card} size="normal" />
          ))}
        </div>
      </section>

      <div className="container">
        {user && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Cards</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unique Players</div>
              <div className="stat-value">{stats.uniquePlayers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Coins</div>
              <div className="stat-value">🪙 {user.coins.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rarest Card</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {stats.byRarity.length > 0
                  ? stats.byRarity.sort((a, b) => {
                      const order = ['prismatic', 'holographic', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];
                      return order.indexOf(a.rarity) - order.indexOf(b.rarity);
                    })[0]?.rarity.toUpperCase()
                  : 'N/A'}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', marginBottom: '1rem' }}>
            How It Works
          </h2>
          <div className="stats-grid" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎴</div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Open Packs</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                3 free packs daily, each with 5 CSA player cards
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💎</div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Discover Rarities</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                7 rarity tiers from Bronze to Prismatic (0.5% drop rate!)
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Trade & Sell</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                List cards on the marketplace or trade directly with players
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', marginBottom: '1.5rem' }}>
            Rarity Tiers
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            {[
              { name: 'Bronze', rate: '40%', gradient: 'var(--gradient-bronze)' },
              { name: 'Silver', rate: '25%', gradient: 'var(--gradient-silver)' },
              { name: 'Gold', rate: '18%', gradient: 'var(--gradient-gold-rarity)' },
              { name: 'Platinum', rate: '10%', gradient: 'var(--gradient-platinum)' },
              { name: 'Diamond', rate: '5%', gradient: 'var(--gradient-diamond)' },
              { name: 'Holographic', rate: '1.5%', gradient: 'var(--gradient-holographic)' },
              { name: 'Prismatic', rate: '0.5%', gradient: 'var(--gradient-prismatic)' },
            ].map(tier => (
              <div key={tier.name} style={{
                padding: '0.6rem 1.25rem',
                background: tier.gradient,
                borderRadius: 'var(--radius-lg)',
                color: ['Silver', 'Gold', 'Platinum'].includes(tier.name) ? '#333' : '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem'
              }}>
                <span>{tier.name}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{tier.rate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
