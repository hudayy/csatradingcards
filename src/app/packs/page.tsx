'use client';

import React, { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { Package, FolderOpen, LogIn, Sparkles, Clock, PartyPopper } from 'lucide-react';

interface CardData {
  id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  tier_name: string | null;
  tier_abbr: string | null;
  rarity: string;
  card_type?: string;
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
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [csaId, setCsaId] = useState<number | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [devMode, setDevMode] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/packs/status').then(r => r.json()),
    ]).then(([authData, packData]) => {
      if (authData.user) {
        setIsLoggedIn(true);
        setCsaId(authData.user.csa_id ?? null);
        setIsUserAdmin(!!authData.user.is_admin);
        if (packData.packs_remaining !== undefined) {
          setPacksRemaining(packData.packs_remaining);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const openPack = async () => {
    if (isOpening || (!devMode && packsRemaining !== null && packsRemaining <= 0)) return;

    setIsOpening(true);
    setRevealedCards([]);
    setFlippedCards(new Set());
    setError(null);

    try {
      const url = devMode ? '/api/packs/open?dev=1' : '/api/packs/open';
      const res = await fetch(url, { method: 'POST' });
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
          <div className="empty-state-icon"><Package size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">
            Sign in with Discord to start opening packs and collecting trading cards.
          </div>
          <a href="/api/auth/discord?redirect=/packs" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
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
              {isOpening ? <Sparkles size={64} /> : <Package size={64} />}
            </div>
            <div className="pack-label">
              {isOpening ? 'Opening...' : 'Standard Pack'}
            </div>
            <div className="pack-sub">
              {isOpening ? 'Generating cards...' : '5 Player Cards'}
            </div>
          </div>

          <div className="pack-remaining">
            {devMode ? (
              <><strong style={{ color: 'var(--accent-green)' }}>∞</strong> packs <span style={{ color: 'var(--accent-green)', fontSize: '0.75rem' }}>(DEV MODE)</span></>
            ) : packsRemaining !== null ? (
              <><strong>{packsRemaining}</strong> free pack{packsRemaining !== 1 ? 's' : ''} remaining today</>
            ) : (
              'Loading...'
            )}
          </div>

          {isUserAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={devMode}
                  onChange={e => setDevMode(e.target.checked)}
                  style={{ accentColor: 'var(--accent-green)', width: 16, height: 16, cursor: 'pointer' }}
                />
                Dev Mode
              </label>
              {devMode && (
                <a href="/admin" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem' }}>
                  Admin Panel →
                </a>
              )}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={openPack}
            disabled={isOpening || (!devMode && packsRemaining !== null && packsRemaining <= 0)}
            style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}
          >
            {isOpening ? <><Sparkles size={18} /> Opening...</> : (!devMode && packsRemaining === 0) ? <><Clock size={18} /> Come Back Tomorrow</> : <><Package size={18} /> Open Free Pack</>}
          </button>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', marginBottom: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <PartyPopper size={22} /> Pack Opened!
              </span>
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {flippedCards.size < revealedCards.length
                ? `${revealedCards.length - flippedCards.size} card${revealedCards.length - flippedCards.size !== 1 ? 's' : ''} left to reveal — click to flip`
                : 'All cards revealed!'}
            </p>
            {flippedCards.size < revealedCards.length && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                onClick={() => setFlippedCards(new Set(revealedCards.map((_, i) => i)))}
              >
                Reveal All
              </button>
            )}
          </div>

          <div className="pack-reveal">
            {revealedCards.map((card, i) => (
              <div
                key={card.id}
                className={`card-flip-wrapper${flippedCards.has(i) ? ' is-flipped' : ''}`}
                style={{ '--flip-delay': `${i * 0.08}s` } as React.CSSProperties}
                onClick={() => { if (!flippedCards.has(i)) setFlippedCards(prev => new Set([...prev, i])); }}
              >
                <div className="card-flip-inner">
                  <div className="card-back">
                    <img src="/csacardslogo.png" alt="CSA Cards" className="card-back-logo" />
                    <div className="card-back-label">CSA Cards</div>
                    <div className="card-back-hint">Click to reveal</div>
                  </div>
                  <div className="card-face">
                    <TradingCard card={card} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setRevealedCards([]);
                setFlippedCards(new Set());
                if (devMode || (packsRemaining && packsRemaining > 0)) {
                  openPack();
                }
              }}
              disabled={!devMode && packsRemaining !== null && packsRemaining <= 0}
            >
              {devMode
                ? <><Package size={18} /> Open Another (∞)</>
                : packsRemaining && packsRemaining > 0
                  ? <><Package size={18} /> Open Another ({packsRemaining} left)</>
                  : <><Clock size={18} /> No Packs Remaining</>}
            </button>
            <a href="/collection" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderOpen size={18} /> View Collection
            </a>
          </div>
        </>
      )}
    </div>
  );
}
