'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';

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
  user_card_id?: number;
}

export default function PacksPage() {
  const [packsRemaining, setPacksRemaining] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [revealedCards, setRevealedCards] = useState<CardData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/packs/status').then(r => r.json()),
    ]).then(([authData, packData]) => {
      if (authData.user) {
        setIsLoggedIn(true);
        if (packData.packs_remaining !== undefined) {
          setPacksRemaining(packData.packs_remaining);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const openPack = async () => {
    if (isOpening || (packsRemaining !== null && packsRemaining <= 0)) return;
    
    setIsOpening(true);
    setRevealedCards([]);
    setError(null);

    try {
      const res = await fetch('/api/packs/open', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to open pack');
        setIsOpening(false);
        return;
      }

      setPacksRemaining(data.packs_remaining);
      
      // Delay reveal for dramatic effect
      setTimeout(() => {
        setRevealedCards(data.cards);
        setIsOpening(false);
      }, 500);
    } catch {
      setError('Network error. Please try again.');
      setIsOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🎴</div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">
            Sign in with Discord to start opening packs and collecting trading cards.
          </div>
          <a href="/api/auth/discord?redirect=/packs" className="btn btn-primary">
            🎮 Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Open Packs</h1>
        <p className="page-subtitle">
          Each pack contains 5 random CSA player cards. Open up to 3 free packs daily!
        </p>
      </div>

      {error && (
        <div style={{
          textAlign: 'center', padding: '1rem',
          background: 'rgba(255, 82, 82, 0.1)',
          border: '1px solid rgba(255, 82, 82, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--accent-red)',
          marginBottom: '2rem'
        }}>
          {error}
        </div>
      )}

      {revealedCards.length === 0 ? (
        <div className="pack-opening-area">
          <div
            className="pack-container"
            onClick={openPack}
            style={{
              opacity: isOpening ? 0.6 : 1,
              pointerEvents: isOpening ? 'none' : 'auto',
            }}
          >
            <div className="pack-icon">
              {isOpening ? '✨' : '🎴'}
            </div>
            <div className="pack-label">
              {isOpening ? 'Opening...' : 'Standard Pack'}
            </div>
            <div className="pack-sub">
              {isOpening ? 'Generating cards...' : '5 Player Cards'}
            </div>
          </div>

          <div className="pack-remaining">
            {packsRemaining !== null ? (
              <>
                <strong>{packsRemaining}</strong> free pack{packsRemaining !== 1 ? 's' : ''} remaining today
              </>
            ) : (
              'Loading...'
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={openPack}
            disabled={isOpening || (packsRemaining !== null && packsRemaining <= 0)}
            style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}
          >
            {isOpening ? '✨ Opening...' : packsRemaining === 0 ? '⏰ Come Back Tomorrow' : '🎴 Open Free Pack'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1.5rem', fontWeight: 800,
              fontFamily: 'Orbitron, sans-serif',
              marginBottom: '0.5rem'
            }}>
              🎉 Pack Opened!
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              You received {revealedCards.length} new cards
            </p>
          </div>

          <div className="pack-reveal">
            {revealedCards.map(card => (
              <TradingCard key={card.id} card={card} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setRevealedCards([]);
                if (packsRemaining && packsRemaining > 0) {
                  openPack();
                }
              }}
              disabled={packsRemaining !== null && packsRemaining <= 0}
            >
              {packsRemaining && packsRemaining > 0
                ? `🎴 Open Another (${packsRemaining} left)`
                : '⏰ No Packs Remaining'}
            </button>
            <a href="/collection" className="btn btn-secondary">
              📁 View Collection
            </a>
          </div>
        </>
      )}
    </div>
  );
}
