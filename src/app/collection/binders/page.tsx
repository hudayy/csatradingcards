'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { BookOpen, LogIn, ArrowLeft } from 'lucide-react';

interface CardData {
  id: string;
  card_id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_id: number | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_conf: string | null;
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
  is_listed: number;
}

interface BinderGroup {
  franchise_id: number | null;
  franchise_name: string;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  cards: CardData[];
}

export default function BindersPage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [binders, setBinders] = useState<BinderGroup[]>([]);
  const [selectedBinder, setSelectedBinder] = useState<BinderGroup | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          return fetch('/api/collection').then(r => r.json());
        }
        return null;
      })
      .then(data => {
        if (data?.cards) {
          const grouped: Record<string, BinderGroup> = {};

          for (const card of data.cards as CardData[]) {
            const key = card.franchise_id != null ? String(card.franchise_id) : '__free_agents__';
            if (!grouped[key]) {
              grouped[key] = {
                franchise_id: card.franchise_id,
                franchise_name: card.franchise_name || 'Free Agents',
                franchise_color: card.franchise_color,
                franchise_logo_url: card.franchise_logo_url,
                cards: [],
              };
            }
            grouped[key].cards.push(card);
          }

          const sorted = Object.values(grouped).sort((a, b) => {
            if (a.franchise_id == null) return 1;
            if (b.franchise_id == null) return -1;
            return b.cards.length - a.cards.length;
          });

          setBinders(sorted);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
          <div className="empty-state-icon"><BookOpen size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">Sign in with Discord to view your franchise binders.</div>
          <a href="/api/auth/discord?redirect=/collection/binders" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
          </a>
        </div>
      </div>
    );
  }

  if (selectedBinder) {
    return (
      <div className="container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedBinder(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="page-title">{selectedBinder.franchise_name}</h1>
            <p className="page-subtitle">{selectedBinder.cards.length} card{selectedBinder.cards.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {selectedBinder.cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No Cards</div>
            <div className="empty-state-text">No cards in this binder.</div>
          </div>
        ) : (
          <div className="card-grid">
            {selectedBinder.cards.map((card, i) => (
              <TradingCard
                key={`${card.card_id || card.id}-${i}`}
                card={{ ...card, id: card.card_id || card.id }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Franchise Binders</h1>
        <p className="page-subtitle">{binders.length} binder{binders.length !== 1 ? 's' : ''}</p>
      </div>

      {binders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BookOpen size={64} /></div>
          <div className="empty-state-title">No Binders Yet</div>
          <div className="empty-state-text">Open packs to start collecting cards and fill your binders!</div>
          <a href="/packs" className="btn btn-primary">Open Packs</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {binders.map(binder => {
            const color = binder.franchise_color || '#333';
            return (
              <div
                key={binder.franchise_id ?? '__free_agents__'}
                onClick={() => setSelectedBinder(binder)}
                style={{
                  background: `linear-gradient(135deg, ${color}cc 0%, ${color}44 60%, var(--bg-card) 100%)`,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${color}44`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                {binder.franchise_logo_url ? (
                  <img
                    src={binder.franchise_logo_url}
                    alt={binder.franchise_name}
                    style={{ width: 64, height: 64, objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: 'var(--radius-md)',
                    background: `${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)',
                  }}>
                    {binder.franchise_name.charAt(0)}
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {binder.franchise_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {binder.cards.length} card{binder.cards.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
