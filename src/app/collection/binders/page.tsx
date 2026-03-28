'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { BookOpen, LogIn, ArrowLeft, Trash2, Coins } from 'lucide-react';

const SALVAGE_VALUES: Record<string, number> = {
  bronze: 6, silver: 10, gold: 15, platinum: 28,
  diamond: 60, holographic: 220, prismatic: 600,
};

interface CardData {
  id: string;
  user_card_id: number;
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
  card_type?: 'player' | 'gm';
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  season_number: number;
  is_listed: number;
  is_locked: number;
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
  const [salvageMode, setSalvageMode] = useState(false);
  const [confirmCard, setConfirmCard] = useState<CardData | null>(null);
  const [salvaging, setSalvaging] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  const handleSalvage = async (card: CardData) => {
    setSalvaging(true);
    setMsg(null);
    try {
      const res = await fetch('/api/collection/salvage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: card.user_card_id }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ text: `Salvaged ${card.player_name} for ${data.coins} coins`, ok: true });
        // Remove card from binder
        const updatedCards = selectedBinder!.cards.filter(c => c.user_card_id !== card.user_card_id);
        const updatedBinder = { ...selectedBinder!, cards: updatedCards };
        setSelectedBinder(updatedBinder);
        setBinders(bs => bs.map(b =>
          b.franchise_id === selectedBinder!.franchise_id ? updatedBinder : b
        ));
        window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.new_balance } }));
      } else {
        setMsg({ text: data.error || 'Failed to salvage', ok: false });
      }
    } catch {
      setMsg({ text: 'Failed to salvage', ok: false });
    }
    setSalvaging(false);
    setConfirmCard(null);
  };

  if (loading) {
    return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;
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
        {/* Confirm salvage modal */}
        {confirmCard && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: 360, width: '90%', textAlign: 'center' }}>
              <Trash2 size={32} style={{ color: 'var(--accent-red, #ef4444)', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Salvage Card?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Salvage <strong>{confirmCard.player_name}</strong> ({confirmCard.rarity}) for{' '}
                <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>
                  <Coins size={13} style={{ display: 'inline', marginRight: 2 }} />
                  {SALVAGE_VALUES[confirmCard.rarity] ?? 10} coins
                </span>?
                This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setConfirmCard(null)} disabled={salvaging}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleSalvage(confirmCard)} disabled={salvaging}>
                  {salvaging ? 'Salvaging...' : 'Salvage'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedBinder(null); setSalvageMode(false); setMsg(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="page-title">{selectedBinder.franchise_name}</h1>
            <p className="page-subtitle">{selectedBinder.cards.length} card{selectedBinder.cards.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            className={`btn btn-sm ${salvageMode ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => { setSalvageMode(s => !s); setMsg(null); }}
          >
            {salvageMode ? 'Done' : 'Salvage Mode'}
          </button>
        </div>

        {msg && (
          <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: msg.ok ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)', border: `1px solid ${msg.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`, color: msg.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {msg.text}
          </div>
        )}

        {salvageMode && (
          <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--text-muted)' }}>
            Click the trash icon on any card to salvage it. Locked and listed cards cannot be salvaged.
          </div>
        )}

        {selectedBinder.cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No Cards</div>
            <div className="empty-state-text">No cards in this binder.</div>
          </div>
        ) : (
          <div className="card-grid">
            {selectedBinder.cards.map((card, i) => (
              <div key={`${card.user_card_id ?? card.card_id}-${i}`} style={{ position: 'relative' }}>
                <TradingCard card={{ ...card, id: card.card_id || card.id }} />
                {salvageMode && !card.is_listed && !card.is_locked && (
                  <button
                    onClick={() => setConfirmCard(card)}
                    title={`Salvage for ${SALVAGE_VALUES[card.rarity] ?? 10} coins`}
                    style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600, zIndex: 10 }}
                  >
                    <Trash2 size={13} /> {SALVAGE_VALUES[card.rarity] ?? 10}
                  </button>
                )}
                {salvageMode && (card.is_listed || card.is_locked) && (
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {card.is_locked ? 'Locked' : 'Listed'}
                  </div>
                )}
              </div>
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
                  <img src={binder.franchise_logo_url} alt={binder.franchise_name} style={{ width: 64, height: 64, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: `${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {binder.franchise_name.charAt(0)}
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{binder.franchise_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{binder.cards.length} card{binder.cards.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
