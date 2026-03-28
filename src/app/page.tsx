'use client';

import { useEffect, useState } from 'react';
import TradingCard from '@/components/TradingCard';
import Link from 'next/link';
import { Package, FolderOpen, LogIn, Gem, ArrowLeftRight, Flame, Gift } from 'lucide-react';

interface CardData {
  id: string;
  card_type?: 'player' | 'gm';
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
  const [featuredCards, setFeaturedCards] = useState<CardData[]>([]);
  const [streak, setStreak] = useState<{ streak: number; claimed_today: boolean; next_milestone: number | null; next_milestone_reward: { coins: number; pack?: string } | null } | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => { if (data.user) setUser(data.user); })
      .catch(() => {});

    fetch('/api/featured')
      .then(r => r.json())
      .then(data => { if (data.cards) setFeaturedCards(data.cards); })
      .catch(() => {});

    fetch('/api/streak')
      .then(r => r.json())
      .then(data => { if (!data.error) setStreak(data); })
      .catch(() => {});
  }, []);

  const handleClaimBonus = async () => {
    setClaimingBonus(true);
    setBonusMsg(null);
    try {
      const res = await fetch('/api/auth/daily-bonus', { method: 'POST' });
      const data = await res.json();
      if (data.claimed) {
        let msg = `+${data.amount} coins claimed!`;
        if (data.streak > 1) msg += ` (${data.streak}-day streak 🔥)`;
        if (data.streakBonus) {
          if (data.streakBonus.coins > 0) msg += ` +${data.streakBonus.coins} streak bonus!`;
          if (data.streakBonus.pack) msg += ` + 1 ${data.streakBonus.pack} pack!`;
        }
        setBonusMsg(msg);
        setStreak(s => s ? { ...s, claimed_today: true, streak: data.streak } : s);
        setUser(u => u ? { ...u, coins: data.newBalance } : u);
      } else {
        setBonusMsg('Already claimed today.');
      }
    } catch {
      setBonusMsg('Failed to claim bonus.');
    }
    setClaimingBonus(false);
  };

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

        {user && streak !== null && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '1rem', marginTop: '1rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-lg)', padding: '0.75rem 1.25rem', flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Flame size={18} style={{ color: streak.streak > 0 ? '#f97316' : 'var(--text-secondary)' }} />
              <span style={{ fontWeight: 700 }}>{streak.streak}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                day streak{streak.next_milestone ? ` — ${streak.next_milestone - streak.streak} to next reward` : ''}
              </span>
            </div>
            <button
              className={`btn ${streak.claimed_today ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleClaimBonus}
              disabled={streak.claimed_today || claimingBonus}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
            >
              <Gift size={15} />
              {streak.claimed_today ? 'Bonus Claimed' : claimingBonus ? 'Claiming...' : 'Claim Daily Bonus'}
            </button>
            {bonusMsg && <span style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>{bonusMsg}</span>}
          </div>
        )}

        <div className="featured-cards">
          {featuredCards.map(card => (
            <TradingCard key={card.id} card={card} size="normal" />
          ))}
        </div>
      </section>

      <div className="container">
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
