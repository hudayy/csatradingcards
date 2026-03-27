'use client';

import { useState, useEffect } from 'react';
import { Coins, Trophy, TrendingUp, Package } from 'lucide-react';
import Link from 'next/link';

interface LeaderboardEntry {
  id: number;
  display_name: string;
  avatar_url: string | null;
  csa_id: number | null;
  coins: number;
  card_count: number;
  collection_value: number;
  net_worth: number;
}

const RARITY_MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { if (d.leaderboard) setLeaderboard(d.leaderboard); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Trophy size={28} style={{ color: 'var(--accent-gold)' }} />
          <div>
            <h1 className="page-title">Leaderboard</h1>
            <p className="page-subtitle">Ranked by net worth — coins + estimated collection value</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Trophy size={48} /></div>
          <div className="empty-state-title">No players yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {leaderboard.map((entry, i) => {
            const rank = i + 1;
            const isTop3 = rank <= 3;
            return (
              <Link
                key={entry.id}
                href={`/u/${entry.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.9rem 1.25rem',
                  background: isTop3
                    ? rank === 1 ? 'rgba(250,204,21,0.08)' : rank === 2 ? 'rgba(192,192,192,0.06)' : 'rgba(205,127,50,0.06)'
                    : 'var(--bg-card)',
                  border: `1px solid ${isTop3
                    ? rank === 1 ? 'rgba(250,204,21,0.3)' : rank === 2 ? 'rgba(192,192,192,0.2)' : 'rgba(205,127,50,0.2)'
                    : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}>
                  {/* Rank */}
                  <div style={{
                    minWidth: 36,
                    textAlign: 'center',
                    fontSize: isTop3 ? '1.4rem' : '1rem',
                    fontWeight: 900,
                    color: isTop3
                      ? rank === 1 ? 'var(--accent-gold)' : rank === 2 ? '#c0c0c0' : '#cd7f32'
                      : 'var(--text-muted)',
                    fontFamily: 'Orbitron, sans-serif',
                  }}>
                    {isTop3 ? RARITY_MEDAL[i] : rank}
                  </div>

                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                    {entry.avatar_url
                      ? <img src={entry.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isTop3 ? (rank === 1 ? 'var(--accent-gold)' : rank === 2 ? '#c0c0c0' : '#cd7f32') : 'var(--border-subtle)'}` }} />
                      : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>{entry.display_name.charAt(0).toUpperCase()}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.display_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {entry.csa_id ? `CSA #${entry.csa_id} · ` : ''}{entry.card_count} cards
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right', display: 'none' }} className="lb-hide-sm">
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <TrendingUp size={12} /> {entry.collection_value.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coins</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <Coins size={12} /> {entry.coins.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Worth</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: isTop3 ? (rank === 1 ? 'var(--accent-gold)' : rank === 2 ? '#c0c0c0' : '#cd7f32') : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                        <Coins size={14} /> {entry.net_worth.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Collection values estimated using marketplace sales history, rarity, and card scarcity.
      </div>
    </div>
  );
}
