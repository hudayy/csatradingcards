'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { Search, Store, FolderOpen, LogIn, Coins, History } from 'lucide-react';

interface ListingData {
  id: number;
  seller_id: number;
  user_card_id: number;
  price: number;
  seller_name: string;
  seller_avatar: string | null;
  expires_at: string | null;
  // Card fields
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
  card_type: string;
  copy_count: number;
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  season_number: number;
}

interface HistoryItem {
  id: number;
  price: number;
  status: string;
  listed_at: string;
  sold_at: string | null;
  expires_at: string | null;
  role: 'seller' | 'buyer';
  other_user: string | null;
  other_avatar: string | null;
  player_name: string;
  rarity: string;
  franchise_name: string | null;
  player_avatar_url: string | null;
}

const RARITIES = ['all', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

const RARITY_COLORS_HEX: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#67e8f9', holographic: '#f472b6', prismatic: '#c084fc',
};

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'history'>('browse');
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [marketCardType, setMarketCardType] = useState('all');
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [unlistingId, setUnlistingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ListingData | null>(null);

  const fetchListings = async () => {
    const params = new URLSearchParams();
    if (selectedRarity !== 'all') params.set('rarity', selectedRarity);
    if (searchQuery) params.set('search', searchQuery);
    if (sortBy) params.set('sort', sortBy);
    if (marketCardType !== 'all') params.set('card_type', marketCardType);

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

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const res = await fetch('/api/marketplace/history');
    const data = await res.json();
    if (data.history) setHistory(data.history);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history' && isLoggedIn) fetchHistory();
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    fetchListings();
  }, [selectedRarity, searchQuery, sortBy, marketCardType]);

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
        if (data.new_balance !== undefined) window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.new_balance } }));
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={`filter-btn ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Store size={15} /> Browse
        </button>
        {isLoggedIn && (
          <button
            className={`filter-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <History size={15} /> My History
          </button>
        )}
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

      {activeTab === 'browse' && (
        <>
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

          {/* Sort and card type */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="">Newest Listed</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="rarity">Rarity (High → Low)</option>
              <option value="name">Name (A–Z)</option>
            </select>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['all', 'player', 'gm'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMarketCardType(t)}
                  className={`btn btn-sm ${marketCardType === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  {t === 'all' ? 'All' : t === 'player' ? 'Players' : 'GMs'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : listings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Store size={64} /></div>
              <div className="empty-state-title">No Listings</div>
              <div className="empty-state-text">
                No cards are currently listed on the marketplace.
                {isLoggedIn ? ' List your cards from the Collection page!' : ' Login to start trading!'}
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
                <div key={listing.id} className="listing-card" onClick={() => setSelectedListing(listing)} style={{ cursor: 'pointer' }}>
                  <TradingCard
                    card={{
                      id: listing.card_id,
                      player_name: listing.player_name,
                      player_avatar_url: listing.player_avatar_url,
                      franchise_name: listing.franchise_name,
                      franchise_abbr: listing.franchise_abbr,
                      franchise_logo_url: listing.franchise_logo_url,
                      franchise_color: listing.franchise_color,
                      franchise_conf: listing.franchise_conf,
                      tier_name: listing.tier_name,
                      tier_abbr: listing.tier_abbr,
                      rarity: listing.rarity,
                      card_type: listing.card_type as 'player' | 'gm',
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
                    Seller: <a href={`/u/${listing.seller_id}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{listing.seller_name}</a>
                  </div>
                  {listing.expires_at && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Expires {new Date(listing.expires_at).toLocaleDateString()}
                    </div>
                  )}
                  {listing.seller_id === currentUserId ? (
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleUnlist(listing); }} disabled={unlistingId === listing.id} style={{ width: '100%', justifyContent: 'center' }}>
                      {unlistingId === listing.id ? 'Removing...' : 'Remove Listing'}
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleBuy(listing); }} disabled={buyingId === listing.id} style={{ width: '100%', justifyContent: 'center' }}>
                      {buyingId === listing.id ? 'Buying...' : 'Buy Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        historyLoading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><History size={64} /></div>
            <div className="empty-state-title">No History Yet</div>
            <div className="empty-state-text">Your marketplace activity will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {history.map(item => (
              <div key={item.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {item.player_avatar_url
                  ? <img src={item.player_avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${RARITY_COLORS_HEX[item.rarity] || 'var(--border-light)'}` }} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{item.player_name.charAt(0)}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.player_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ color: RARITY_COLORS_HEX[item.rarity] || 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 600 }}>{item.rarity}</span>
                    {item.franchise_name && <span>{item.franchise_name}</span>}
                    {item.other_user && <span>{item.role === 'seller' ? `→ ${item.other_user}` : `← ${item.other_user}`}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: item.role === 'seller' ? 'var(--accent-green)' : 'var(--accent-gold)', fontSize: '0.95rem' }}>
                    <Coins size={14} /> {item.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {item.status === 'sold' ? `Sold ${item.sold_at ? new Date(item.sold_at).toLocaleDateString() : ''}` : item.status === 'active' ? 'Listed' : item.status}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: item.role === 'seller' ? 'var(--accent-green)' : 'var(--accent-blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {item.role === 'seller' ? 'Sold' : 'Bought'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Card detail modal */}
      {selectedListing && (
        <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedListing.player_name}</h3>
              <button className="modal-close" onClick={() => setSelectedListing(null)}>×</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <TradingCard
                size="small"
                card={{
                  id: selectedListing.card_id,
                  card_type: selectedListing.card_type as 'player' | 'gm',
                  player_name: selectedListing.player_name,
                  player_avatar_url: selectedListing.player_avatar_url,
                  franchise_name: selectedListing.franchise_name,
                  franchise_abbr: selectedListing.franchise_abbr,
                  franchise_logo_url: selectedListing.franchise_logo_url,
                  franchise_color: selectedListing.franchise_color,
                  franchise_conf: selectedListing.franchise_conf,
                  tier_name: selectedListing.tier_name,
                  tier_abbr: selectedListing.tier_abbr,
                  rarity: selectedListing.rarity,
                  stat_gpg: selectedListing.stat_gpg,
                  stat_apg: selectedListing.stat_apg,
                  stat_svpg: selectedListing.stat_svpg,
                  stat_win_pct: selectedListing.stat_win_pct,
                  salary: selectedListing.salary,
                  overall_rating: selectedListing.overall_rating,
                  season_number: selectedListing.season_number,
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.75rem' }}>
                {selectedListing.copy_count === 1 ? '✦ Only 1 copy exists' : `${selectedListing.copy_count} copies exist across all collections`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
              <Coins size={18} /> {selectedListing.price.toLocaleString()}
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Listed by <a href={`/u/${selectedListing.seller_id}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{selectedListing.seller_name}</a>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedListing(null)}>Close</button>
              {selectedListing.seller_id === currentUserId ? (
                <button className="btn btn-danger" onClick={() => { handleUnlist(selectedListing); setSelectedListing(null); }} disabled={unlistingId === selectedListing.id}>
                  {unlistingId === selectedListing.id ? 'Removing...' : 'Remove Listing'}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => { handleBuy(selectedListing); setSelectedListing(null); }} disabled={buyingId === selectedListing.id}>
                  {buyingId === selectedListing.id ? 'Buying...' : 'Buy Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
