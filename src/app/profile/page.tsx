'use client';

import { useState, useEffect } from 'react';
import { Coins, Package, Users, ArrowLeftRight, ShoppingBag, Star, TrendingUp, Clock, LogIn } from 'lucide-react';

const RARITY_ORDER = ['prismatic', 'holographic', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];
const RARITY_COLORS: Record<string, string> = {
  prismatic: '#e879f9',
  holographic: '#38bdf8',
  diamond: '#67e8f9',
  platinum: '#94a3b8',
  gold: '#fbbf24',
  silver: '#9ca3af',
  bronze: '#b45309',
};

interface UserData {
  id: number;
  discord_username: string;
  csa_id: number | null;
  csa_name: string | null;
  avatar_url: string | null;
  coins: number;
  created_at: string;
  last_login: string;
}

interface Stats {
  totalCards: number;
  listedCards: number;
  uniquePlayers: number;
  byRarity: { rarity: string; count: number }[];
  byFranchise: { franchise_name: string; franchise_logo_url: string | null; franchise_color: string | null; count: number }[];
  bestCard: { player_name: string; rarity: string; overall_rating: number; franchise_name: string | null; tier_name: string | null; player_avatar_url: string | null } | null;
  totalPacksOpened: number;
  tradesCompleted: number;
  salesCompleted: number;
  purchasesCompleted: number;
  bySource: { source: string; count: number }[];
  recentCards: { player_name: string; rarity: string; franchise_name: string | null; player_avatar_url: string | null; acquired_at: string; source: string }[];
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ color: color || 'var(--accent-blue)', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      if (d.user) { setUser(d.user); setStats(d.stats); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><LogIn size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">Sign in to view your profile.</div>
          <a href="/api/auth/discord?redirect=/profile" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
          </a>
        </div>
      </div>
    );
  }

  const totalByRarity = Object.fromEntries((stats?.byRarity || []).map(r => [r.rarity, r.count]));
  const maxRarityCount = Math.max(...(stats?.byRarity.map(r => r.count) || [1]), 1);
  const memberSince = new Date(user.created_at);
  const daysSince = Math.floor((Date.now() - memberSince.getTime()) / 86400000);

  const sourceMap = Object.fromEntries((stats?.bySource || []).map(s => [s.source, s.count]));

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid var(--border-light)' }} />
          : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800 }}>{(user.csa_name || user.discord_username).charAt(0).toUpperCase()}</div>
        }
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, fontFamily: 'Orbitron, sans-serif' }}>{user.csa_name || user.discord_username}</h1>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
            {user.csa_id && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CSA ID #{user.csa_id}</span>}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.discord_username}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Joined {memberSince.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent-gold)' }}>
            <Coins size={24} /> {user.coins.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>coins</div>
        </div>
      </div>

      {/* Key stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard icon={<Package size={22} />} label="Cards Owned" value={stats?.totalCards ?? 0} color="var(--accent-blue)" />
        <StatCard icon={<Users size={22} />} label="Unique Players" value={stats?.uniquePlayers ?? 0} color="var(--accent-green)" />
        <StatCard icon={<Package size={22} />} label="Packs Opened" value={stats?.totalPacksOpened ?? 0} color="var(--accent-blue)" />
        <StatCard icon={<ArrowLeftRight size={22} />} label="Trades Done" value={stats?.tradesCompleted ?? 0} color="var(--accent-purple, #a78bfa)" />
        <StatCard icon={<ShoppingBag size={22} />} label="Cards Sold" value={stats?.salesCompleted ?? 0} sub={`${stats?.purchasesCompleted ?? 0} purchased`} color="var(--accent-gold)" />
        <StatCard icon={<TrendingUp size={22} />} label="Listed Now" value={stats?.listedCards ?? 0} color="var(--accent-gold)" />
        <StatCard icon={<Clock size={22} />} label="Days Active" value={daysSince} color="var(--text-muted)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Rarity breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', fontFamily: 'Orbitron, sans-serif' }}>Collection by Rarity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {RARITY_ORDER.map(rarity => {
              const count = totalByRarity[rarity] || 0;
              const pct = maxRarityCount > 0 ? (count / maxRarityCount) * 100 : 0;
              return (
                <div key={rarity}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.78rem' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: RARITY_COLORS[rarity] || 'var(--text-primary)' }}>{rarity}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: RARITY_COLORS[rarity] || 'var(--accent-blue)', borderRadius: 99, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Best card + top franchises */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Best card */}
          {stats?.bestCard && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', flex: 1 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Orbitron, sans-serif', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Star size={15} style={{ color: 'var(--accent-gold)' }} /> Best Card
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {stats.bestCard.player_avatar_url
                  ? <img src={stats.bestCard.player_avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${RARITY_COLORS[stats.bestCard.rarity] || 'var(--border-light)'}` }} />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{stats.bestCard.player_name.charAt(0)}</div>
                }
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stats.bestCard.player_name}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    <span style={{ color: RARITY_COLORS[stats.bestCard.rarity] || 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 600 }}>{stats.bestCard.rarity}</span>
                    {stats.bestCard.franchise_name && <span style={{ color: 'var(--text-muted)' }}>{stats.bestCard.franchise_name}</span>}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-gold)' }}>{stats.bestCard.overall_rating}</div>
              </div>
            </div>
          )}

          {/* Top franchises */}
          {stats?.byFranchise && stats.byFranchise.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', flex: 1 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Orbitron, sans-serif' }}>Top Franchises</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {stats.byFranchise.slice(0, 4).map(f => (
                  <div key={f.franchise_name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                    {f.franchise_logo_url
                      ? <img src={f.franchise_logo_url} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                      : <div style={{ width: 20, height: 20, borderRadius: '50%', background: f.franchise_color || 'var(--border-subtle)' }} />
                    }
                    <span style={{ flex: 1, fontWeight: 600 }}>{f.franchise_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{f.count} cards</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How cards were obtained + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Card sources */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Orbitron, sans-serif' }}>How Cards Were Obtained</h3>
          {stats?.bySource && stats.bySource.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {stats.bySource.map(s => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{s.source === 'pack' ? 'Pack Opens' : s.source === 'trade' ? 'Trades' : s.source === 'reward' ? 'Rewards' : s.source}</span>
                  <span style={{ fontWeight: 700 }}>{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No cards yet</span>
          )}
        </div>

        {/* Recent additions */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Orbitron, sans-serif' }}>Recent Additions</h3>
          {stats?.recentCards && stats.recentCards.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {stats.recentCards.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                  {c.player_avatar_url
                    ? <img src={c.player_avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
                    : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border-subtle)', flexShrink: 0 }} />
                  }
                  <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.player_name}</span>
                  <span style={{ color: RARITY_COLORS[c.rarity] || 'var(--text-muted)', textTransform: 'capitalize', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}>{c.rarity}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No cards yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
