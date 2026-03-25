'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { Search, Store, FolderOpen, LogIn, Coins } from 'lucide-react';

interface ListingData {
  id: number;
  seller_id: number;
  user_card_id: number;
  price: number;
  seller_name: string;
  seller_avatar: string | null;
  // Card fields
  card_id: string;
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
}

const RARITIES = ['all', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

export default function MarketplacePage() {
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [unlistingId, setUnlistingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const fetchListings = async () => {
    const params = new URLSearchParams();
    if (selectedRarity !== 'all') params.set('rarity', selectedRarity);
    if (searchQuery) params.set('search', searchQuery);

    const res = await fetch(`/api/marketplace?${params.toString()}`);
    const data = await res.json();
    if (data.listings) setListings(data.listings);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) { setIsLoggedIn(true); setCurrentUserId(d.user.id); }
    });
    fetchListings();
  }, []);

  useEffect(() => {
    fetchListings();
  }, [selectedRarity, searchQuery]);

  const handleBuy = async (listing: ListingData) => {
    if (!isLoggedIn) {
      window.location.href = '/api/auth/discord?redirect=/marketplace';
      return;
    }

    setBuyingId(listing.id);
    try {
      const res = await fetch(`/api/marketplace/${listing.id}/buy`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setMessage({ text: `Successfully purchased ${listing.player_name}'s card!`, type: 'success' });
        fetchListings();
      } else {
        setMessage({ text: data.error || 'Purchase failed', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    }
    setBuyingId(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUnlist = async (listing: ListingData) => {
    setUnlistingId(listing.id);
    try {
      const res = await fetch('/api/marketplace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: listing.user_card_id }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Listing removed.', type: 'success' });
        fetchListings();
      } else {
        setMessage({ text: data.error || 'Failed to remove listing', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    }
    setUnlistingId(null);
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Marketplace</h1>
        <p className="page-subtitle">Buy and sell trading cards with other collectors</p>
      </div>

      {message && (
        <div style={{
          textAlign: 'center', padding: '0.75rem',
          background: message.type === 'success' ? 'var(--accent-green-dim)' : 'rgba(255, 82, 82, 0.1)',
          borderRadius: 'var(--radius-md)',
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          marginBottom: '1rem'
        }}>
          {message.text}
        </div>
      )}

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

      {/* Filters */}
      <div className="filters">
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

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Store size={64} /></div>
          <div className="empty-state-title">No Listings</div>
          <div className="empty-state-text">
            No cards are currently listed on the marketplace.
            {isLoggedIn
              ? ' List your cards from the Collection page!'
              : ' Login to start trading!'}
          </div>
          {isLoggedIn ? (
            <a href="/collection" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><FolderOpen size={18} /> Go to Collection</a>
          ) : (
            <a href="/api/auth/discord?redirect=/marketplace" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><LogIn size={18} /> Login</a>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {listings.map(listing => (
            <div key={listing.id} className="listing-card">
              <TradingCard
                card={{
                  id: listing.card_id,
                  player_name: listing.player_name,
                  player_avatar_url: listing.player_avatar_url,
                  franchise_name: listing.franchise_name,
                  franchise_abbr: listing.franchise_abbr,
                  tier_name: listing.tier_name,
                  tier_abbr: listing.tier_abbr,
                  rarity: listing.rarity,
                  stat_gpg: listing.stat_gpg,
                  stat_apg: listing.stat_apg,
                  stat_svpg: listing.stat_svpg,
                  stat_win_pct: listing.stat_win_pct,
                  salary: listing.salary,
                  overall_rating: listing.overall_rating,
                  season_number: listing.season_number,
                }}
                size="small"
              />
              <div className="listing-price" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Coins size={16} /> {listing.price.toLocaleString()}</div>
              <div className="listing-seller">
                Seller: {listing.seller_name}
              </div>
              {listing.seller_id === currentUserId ? (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleUnlist(listing)}
                  disabled={unlistingId === listing.id}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {unlistingId === listing.id ? 'Removing...' : 'Remove Listing'}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleBuy(listing)}
                  disabled={buyingId === listing.id}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {buyingId === listing.id ? 'Buying...' : 'Buy Now'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
