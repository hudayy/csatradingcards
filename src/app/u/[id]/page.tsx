'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import TradingCard from '@/components/TradingCard';
import { Package, Users, ArrowLeftRight, Star, LogIn, FolderOpen, TrendingUp, Coins } from 'lucide-react';

interface ShowcaseCard {
  position: number;
  user_card_id: number;
  card_id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_conf: string | null;
  tier_name: string | null;
  tier_abbr: string | null;
  rarity: string;
  card_type: string;
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  season_number: number;
}

interface PublicProfile {
  user: {
    id: number;
    discord_username: string;
    csa_id: number | null;
    csa_name: string | null;
    avatar_url: string | null;
    created_at: string;
    coins: number;
  };
  showcase: ShowcaseCard[];
  stats: {
    totalCards: number;
    uniquePlayers: number;
    totalPacksOpened: number;
    tradesCompleted: number;
  };
  collection_value: number;
  net_worth: number;
}

const CARD_WIDTH = 260;
const GAP = 16;

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params?.id;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const [cardZoom, setCardZoom] = useState(1);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}/profile`)
      .then(r => r.json())
      .then(d => {
        if (d.user) setProfile(d as PublicProfile);
        else setNotFound(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [userId]);

  // Resize showcase cards to always fill the container width
  useEffect(() => {
    if (!profile?.showcase.length) return;
    const el = showcaseRef.current;
    if (!el) return;

    const update = () => {
      // treat 1 card same as 2 (so it's not oversized)
      const n = Math.max(2, profile.showcase.length);
      const available = el.clientWidth - (n - 1) * GAP;
      setCardZoom(Math.min(1.5, available / (n * CARD_WIDTH)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [profile?.showcase.length]);

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  if (notFound || !profile) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><LogIn size={64} /></div>
          <div className="empty-state-title">Player Not Found</div>
          <div className="empty-state-text">This player doesn&apos;t have a public profile.</div>
        </div>
      </div>
    );
  }

  const { user, showcase, stats } = profile;
  const displayName = user.csa_name || user.discord_username;
  const memberSince = new Date(user.created_at);

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid var(--border-light)' }} />
          : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800 }}>{displayName.charAt(0).toUpperCase()}</div>
        }
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, fontFamily: 'Orbitron, sans-serif' }}>{displayName}</h1>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
            {user.csa_id && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CSA ID #{user.csa_id}</span>}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.discord_username}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Joined {memberSince.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        <a
          href={`/u/${userId}/collection`}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, fontSize: '0.85rem' }}
        >
          <FolderOpen size={15} /> View Collection
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        {[
          { icon: <Package size={20} />, label: 'Cards Owned', value: stats.totalCards, color: 'var(--accent-blue)' },
          { icon: <Users size={20} />, label: 'Unique Players', value: stats.uniquePlayers, color: 'var(--accent-green)' },
          { icon: <Package size={20} />, label: 'Packs Opened', value: stats.totalPacksOpened, color: 'var(--accent-blue)' },
          { icon: <ArrowLeftRight size={20} />, label: 'Trades Done', value: stats.tradesCompleted, color: 'var(--accent-purple, #a78bfa)' },
          { icon: <TrendingUp size={20} />, label: 'Collection Value', value: profile.collection_value, color: 'var(--accent-green)' },
          { icon: <Coins size={20} />, label: 'Net Worth', value: profile.net_worth, color: 'var(--accent-gold)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Showcase */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', fontFamily: 'Orbitron, sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star size={16} style={{ color: 'var(--accent-gold)' }} /> Display Case
        </h2>
        {showcase.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {displayName} hasn&apos;t set up their display case yet.
          </div>
        ) : (
          <div
            ref={showcaseRef}
            style={{ display: 'flex', gap: GAP, justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden' }}
          >
            {showcase.map(card => (
              <div key={card.position} style={{ zoom: cardZoom, flexShrink: 0 }}>
                <TradingCard
                  card={{
                    id: card.card_id,
                    card_type: card.card_type as 'player' | 'gm',
                    player_name: card.player_name,
                    player_avatar_url: card.player_avatar_url,
                    franchise_name: card.franchise_name,
                    franchise_abbr: null,
                    franchise_logo_url: card.franchise_logo_url,
                    franchise_color: card.franchise_color,
                    franchise_conf: card.franchise_conf,
                    tier_name: card.tier_name,
                    tier_abbr: card.tier_abbr,
                    rarity: card.rarity,
                    stat_gpg: card.stat_gpg,
                    stat_apg: card.stat_apg,
                    stat_svpg: card.stat_svpg,
                    stat_win_pct: card.stat_win_pct,
                    salary: card.salary,
                    overall_rating: card.overall_rating,
                    season_number: card.season_number,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
