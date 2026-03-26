'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Coins, Package, FolderOpen, ShoppingBag, Zap, Crown, Gem, ChevronLeft, LogIn } from 'lucide-react';
import TradingCard from '@/components/TradingCard';
import { PACK_CONFIGS, type PackType } from '@/lib/pack-config';

const RARITY_COLORS: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#67e8f9', holographic: '#f472b6', prismatic: '#c084fc',
};

interface CardData {
  id: string; player_name: string; player_avatar_url: string | null;
  franchise_name: string | null; franchise_abbr: string | null; franchise_logo_url?: string | null;
  franchise_color?: string | null; franchise_conf?: string | null;
  tier_name: string | null; tier_abbr: string | null; rarity: string;
  stat_gpg: number; stat_apg: number; stat_svpg: number; stat_win_pct: number;
  salary: number; overall_rating: number; season_number: number; user_card_id?: number;
}

const PACK_ICONS: Record<PackType, React.ElementType> = {
  standard: Zap, elite: Crown, apex: Gem,
};

const PACK_BADGES: Record<PackType, { label: string; color: string } | null> = {
  standard: null,
  elite: { label: 'POPULAR', color: 'rgba(251,191,36,0.9)' },
  apex: { label: 'PREMIUM', color: 'rgba(139,92,246,0.9)' },
};

function PackVisual({ packType, pulse = false }: { packType: PackType; pulse?: boolean }) {
  const Icon = PACK_ICONS[packType];
  const config = PACK_CONFIGS[packType];
  return (
    <div className={`pv pv-${packType}${pulse ? ' pv-pulse' : ''}`}>
      <div className="pv-seal" />
      <div className="pv-main">
        <div className="pv-emblem-glow" />
        <Icon size={58} className="pv-icon" strokeWidth={1.5} />
        <div className="pv-brand">CSA</div>
        <div className="pv-five">5 CARDS</div>
      </div>
      <div className="pv-foot">
        <span className="pv-foot-name">{config.name.replace(' Pack', '').toUpperCase()}</span>
        <span className="pv-foot-sub">{config.subtitle}</span>
      </div>
    </div>
  );
}

type ShopView = 'shop' | 'reveal';

export default function ShopPage() {
  const [view, setView] = useState<ShopView>('shop');
  const [coins, setCoins] = useState<number | null>(null);
  const [packsRemaining, setPacksRemaining] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<PackType | null>(null);
  const [lastPackType, setLastPackType] = useState<PackType>('standard');
  const [revealedCards, setRevealedCards] = useState<CardData[]>([]);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    function onMouseUp() { isDragging.current = false; }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/packs/status').then(r => r.json()),
    ]).then(([auth, packs]) => {
      if (auth.user) {
        setIsLoggedIn(true);
        setCoins(auth.user.coins);
        if (packs.packs_remaining !== undefined) setPacksRemaining(packs.packs_remaining);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleBuy = async (packType: PackType) => {
    if (purchasing) return;
    const cost = PACK_CONFIGS[packType].cost;
    if (coins === null || coins < cost) return;

    setPurchasing(packType);
    setError(null);

    try {
      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_type: packType, paid: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Purchase failed');
        setPurchasing(null);
        return;
      }
      const newBalance = data.new_balance ?? (coins! - cost);
      setCoins(newBalance);
      window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: newBalance } }));
      setLastPackType(packType);
      setRevealedCards(data.cards);
      setFlippedCards(new Set());
      setView('reveal');
    } catch {
      setError('Network error. Please try again.');
    }
    setPurchasing(null);
  };

  if (loading) return (
    <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>
  );

  if (!isLoggedIn) return (
    <div className="container">
      <div className="empty-state">
        <div className="empty-state-icon"><ShoppingBag size={64} /></div>
        <div className="empty-state-title">Login Required</div>
        <div className="empty-state-text">Sign in with Discord to visit the shop.</div>
        <a href="/api/auth/discord?redirect=/shop" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogIn size={18} /> Login with Discord
        </a>
      </div>
    </div>
  );

  if (view === 'reveal') {
    const unflipped = revealedCards.length - flippedCards.size;
    return (
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => { setView('shop'); setRevealedCards([]); setFlippedCards(new Set()); }}>
            <ChevronLeft size={16} /> Back to Shop
          </button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', marginBottom: '0.5rem' }}>
            {PACK_CONFIGS[lastPackType].name} Opened!
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {unflipped > 0 ? `${unflipped} card${unflipped !== 1 ? 's' : ''} left to reveal — click to flip` : 'All cards revealed!'}
          </p>
          {coins !== null && (
            <p style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
              <Coins size={14} /> Balance: {coins.toLocaleString()} coins
            </p>
          )}
        </div>

        <div className="pack-reveal" onMouseDown={() => { isDragging.current = true; }}>
          {revealedCards.map((card, i) => (
            <div
              key={card.id}
              className={`card-flip-wrapper${flippedCards.has(i) ? ' is-flipped' : ''}`}
              style={{ '--flip-delay': `${i * 0.08}s` } as React.CSSProperties}
              onClick={() => { if (!flippedCards.has(i)) setFlippedCards(prev => new Set([...prev, i])); }}
              onMouseEnter={() => { if (isDragging.current && !flippedCards.has(i)) setFlippedCards(prev => new Set([...prev, i])); }}
            >
              <div className="card-flip-inner">
                <div className="card-back">
                  <img src="/csacardslogo.png" alt="CSA Cards" className="card-back-logo" />
                  <div className="card-back-label">CSA Cards</div>
                  <div className="card-back-hint">Click to reveal</div>
                </div>
                <div className="card-face"><TradingCard card={card} /></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setView('shop'); setRevealedCards([]); setFlippedCards(new Set()); }}>
            <ShoppingBag size={18} /> Buy Another Pack
          </button>
          <a href="/collection" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderOpen size={18} /> View Collection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Card Shop</h1>
        <p className="page-subtitle">Spend coins to open premium packs</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        {coins !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: '999px', padding: '6px 16px', fontWeight: 700, color: 'var(--accent-gold)' }}>
            <Coins size={16} /> {coins.toLocaleString()} coins
          </div>
        )}
        {packsRemaining !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: '6px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Package size={14} /> {packsRemaining} free pack{packsRemaining !== 1 ? 's' : ''} remaining today
            {packsRemaining > 0 && <> · <Link href="/packs" style={{ color: 'var(--accent-gold)', textDecoration: 'none' }}>Open free</Link></>}
          </div>
        )}
      </div>

      {error && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="shop-grid">
        {(Object.keys(PACK_CONFIGS) as PackType[]).map(packType => {
          const config = PACK_CONFIGS[packType];
          const badge = PACK_BADGES[packType];
          const canAfford = coins !== null && coins >= config.cost;
          const isBuying = purchasing === packType;

          return (
            <div key={packType} className={`shop-card shop-card-${packType}`}>
              {badge && (
                <div className="shop-badge" style={{ background: badge.color, color: '#000' }}>{badge.label}</div>
              )}

              <PackVisual packType={packType} pulse={isBuying} />

              <div className="shop-card-info">
                <h3 className="shop-pack-name">{config.name}</h3>
                <p className="shop-pack-flavour">{config.flavour}</p>

                <div className="shop-rarity-row">
                  {config.allowedRarities.map(r => (
                    <div
                      key={r}
                      className="rarity-pip"
                      style={{ background: RARITY_COLORS[r], boxShadow: `0 0 6px ${RARITY_COLORS[r]}88` }}
                      title={r.charAt(0).toUpperCase() + r.slice(1)}
                    />
                  ))}
                </div>

                <div className="shop-price-row">
                  <Coins size={20} />
                  <span>{config.cost.toLocaleString()}</span>
                </div>

                <button
                  className={`btn shop-buy-btn shop-buy-${packType}`}
                  onClick={() => handleBuy(packType)}
                  disabled={!!purchasing || !canAfford}
                >
                  {isBuying ? 'Opening...' : !canAfford ? `Need ${(config.cost - (coins ?? 0)).toLocaleString()} more coins` : 'Buy & Open'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Earn coins by selling cards on the marketplace, completing trades, and collecting your daily login bonus.
      </div>
    </div>
  );
}
