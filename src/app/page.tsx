'use client';

import { useEffect, useState } from 'react';
import TradingCard from '@/components/TradingCard';
import Link from 'next/link';
import { Package, FolderOpen, LogIn, Coins, Gem, ArrowLeftRight } from 'lucide-react';

interface CardData {
  id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_logo_url?: string | null;
  franchise_color?: string | null;
  franchise_conf?: string | null;
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

export default function HomePage() {
  const [user, setUser] = useState<{ coins: number } | null>(null);
  const [stats, setStats] = useState<{ total: number; uniquePlayers: number; byRarity: { rarity: string; count: number }[] } | null>(null);
  const [featuredCards, setFeaturedCards] = useState<CardData[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) setUser(data.user);
        if (data.stats) setStats(data.stats);
      })
      .catch(() => {});

    fetch('/api/featured')
      .then(r => r.json())
      .then(data => { if (data.cards) setFeaturedCards(data.cards); })
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginBottom: '0.25rem' }}>
          <img src="/csacardslogo.png" alt="CSA Cards" style={{ height: '80px', width: 'auto' }} />
          <h1 className="hero-title" style={{ margin: 0 }}>
            <span className="highlight">CSA</span> Trading Cards
          </h1>
        </div>
        <p className="hero-subtitle">
          Collect digital trading cards of your favorite CSA Rocket League players.
          Open packs daily, discover rare cards, and trade with the community.
        </p>
        <div className="hero-cta">
          {user ? (
            <>
              <Link href="/packs" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Open Packs</Link>
              <Link href="/collection" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FolderOpen size={18} /> My Collection</Link>
            </>
          ) : (
            <a href="/api/auth/discord" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><LogIn size={18} /> Login with Discord</a>
          )}
        </div>

        <div className="featured-cards">
          {featuredCards.map(card => (
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
              <div className="stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}><Coins size={20} /> {user.coins.toLocaleString()}</div>
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
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><Package size={40} /></div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Open Packs</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                3 free packs daily, each with 5 CSA player cards
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><Gem size={40} /></div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Discover Rarities</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                7 rarity tiers from Bronze to Prismatic (0.5% drop rate!)
              </div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}><ArrowLeftRight size={40} /></div>
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
              { name: 'Bronze', rate: '2 in 5', gradient: 'var(--gradient-bronze)' },
              { name: 'Silver', rate: '1 in 4', gradient: 'var(--gradient-silver)' },
              { name: 'Gold', rate: '9 in 50', gradient: 'var(--gradient-gold-rarity)' },
              { name: 'Platinum', rate: '1 in 10', gradient: 'var(--gradient-platinum)' },
              { name: 'Diamond', rate: '1 in 20', gradient: 'var(--gradient-diamond)' },
              { name: 'Holographic', rate: '1 in 67', gradient: 'var(--gradient-holographic)' },
              { name: 'Prismatic', rate: '1 in 200', gradient: 'var(--gradient-prismatic)' },
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
