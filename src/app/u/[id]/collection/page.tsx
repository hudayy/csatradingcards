'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import TradingCard from '@/components/TradingCard';
import { Search, ArrowLeft, FolderOpen } from 'lucide-react';

interface CardData {
  user_card_id: number;
  card_id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_logo_url: string | null;
  franchise_color: string | null;
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
}

interface UserInfo {
  id: number;
  discord_username: string;
  csa_name: string | null;
  avatar_url: string | null;
}

const RARITIES = ['all', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

export default function PublicCollectionPage() {
  const params = useParams();
  const userId = params?.id;

  const [user, setUser] = useState<UserInfo | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCards = async (rarity: string, search: string) => {
    if (!userId) return;
    const p = new URLSearchParams();
    if (rarity !== 'all') p.set('rarity', rarity);
    if (search) p.set('search', search);
    const res = await fetch(`/api/users/${userId}/collection?${p.toString()}`);
    const data = await res.json();
    if (data.cards) {
      setCards(data.cards);
      if (data.user && !user) setUser(data.user);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCards(selectedRarity, searchQuery);
  }, [userId]);

  useEffect(() => {
    if (!loading) fetchCards(selectedRarity, searchQuery);
  }, [selectedRarity, searchQuery]);

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  if (notFound || !user) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><FolderOpen size={64} /></div>
          <div className="empty-state-title">Collection Not Found</div>
        </div>
      </div>
    );
  }

  const displayName = user.csa_name || user.discord_username;

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <a href={`/u/${userId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Back to Profile
        </a>
      </div>

      <div className="page-header">
        <h1 className="page-title">{displayName}&apos;s Collection</h1>
        <p className="page-subtitle">{cards.length} card{cards.length !== 1 ? 's' : ''} shown</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
          <Search size={16} />
        </span>
        <input
          type="text"
          className="search-input"
          placeholder="Search by player name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ paddingLeft: '2.25rem' }}
        />
      </div>

      {/* Rarity filters */}
      <div className="filters" style={{ marginBottom: '1.5rem' }}>
        {RARITIES.map(r => (
          <button
            key={r}
            className={`filter-btn ${selectedRarity === r ? 'active' : ''}`}
            onClick={() => setSelectedRarity(r)}
          >
            {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FolderOpen size={64} /></div>
          <div className="empty-state-title">No Cards Found</div>
          <div className="empty-state-text">No cards match your filters.</div>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map(card => (
            <TradingCard
              key={card.user_card_id}
              card={{
                id: card.card_id,
                card_type: card.card_type,
                player_name: card.player_name,
                player_avatar_url: card.player_avatar_url,
                franchise_name: card.franchise_name,
                franchise_abbr: card.franchise_abbr,
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
          ))}
        </div>
      )}
    </div>
  );
}
