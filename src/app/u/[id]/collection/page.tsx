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
  copy_count?: number;
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
  const [sortBy, setSortBy] = useState<'rarity' | 'name_asc' | 'name_desc' | 'newest' | 'oldest'>('rarity');
  const [cardType, setCardType] = useState<'all' | 'player' | 'gm'>('all');
  const [selectedCard, setSelectedCard] = useState<(CardData & { copy_count?: number }) | null>(null);

  const fetchCards = async (rarity: string, search: string, sort: typeof sortBy, type: typeof cardType) => {
    if (!userId) return;
    const p = new URLSearchParams();
    if (rarity !== 'all') p.set('rarity', rarity);
    if (search) p.set('search', search);
    if (sort !== 'rarity') p.set('sort', sort);
    if (type !== 'all') p.set('card_type', type);
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
    fetchCards(selectedRarity, searchQuery, sortBy, cardType);
  }, [userId]);

  useEffect(() => {
    if (!loading) fetchCards(selectedRarity, searchQuery, sortBy, cardType);
  }, [selectedRarity, searchQuery, sortBy, cardType]);

  const handleCardClick = async (card: CardData) => {
    setSelectedCard({ ...card, copy_count: undefined });
    const res = await fetch(`/api/cards/${card.card_id}/value`);
    const data = await res.json();
    setSelectedCard(prev => prev?.card_id === card.card_id ? { ...prev, copy_count: data.copy_count ?? 0 } : prev);
  };

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
      {selectedCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedCard(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '1.5rem 2rem', maxWidth: 360, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{selectedCard.player_name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'capitalize' }}>
              {selectedCard.rarity}{selectedCard.franchise_name ? ` · ${selectedCard.franchise_name}` : ''} · Season {selectedCard.season_number}
            </div>
            {selectedCard.copy_count !== undefined ? (
              <div style={{ fontSize: '0.9rem' }}>
                <strong>{selectedCard.copy_count}</strong> {selectedCard.copy_count === 1 ? 'copy exists' : 'copies exist'} in total
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</div>
            )}
            <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setSelectedCard(null)}>Close</button>
          </div>
        </div>
      )}

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

      {/* Filters row */}
      <div className="filters" style={{ marginBottom: '0.75rem' }}>
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

      {/* Card type + sort row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['all', 'player', 'gm'] as const).map(t => (
          <button key={t} className={`filter-btn ${cardType === t ? 'active' : ''}`} onClick={() => setCardType(t)}>
            {t === 'all' ? 'All Types' : t === 'player' ? 'Players' : 'GMs'}
          </button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', marginLeft: 'auto' }}>
          <option value="rarity">Sort: Rarity</option>
          <option value="name_asc">Sort: Name A–Z</option>
          <option value="name_desc">Sort: Name Z–A</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
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
            <div key={card.user_card_id} onClick={() => handleCardClick(card)} style={{ cursor: 'pointer' }}>
              <TradingCard
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
