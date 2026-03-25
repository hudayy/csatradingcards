'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { FolderOpen, LogIn, Package, Coins, Tag } from 'lucide-react';

interface CardData {
  id: string;
  user_card_id?: number;
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
  is_listed: number;
}

const RARITIES = ['all', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

export default function CollectionPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listingStatus, setListingStatus] = useState<string | null>(null);

  const fetchCards = async (rarity?: string) => {
    const params = new URLSearchParams();
    if (rarity && rarity !== 'all') params.set('rarity', rarity);
    
    const res = await fetch(`/api/collection?${params.toString()}`);
    const data = await res.json();
    if (data.cards) setCards(data.cards);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          fetchCards().then(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchCards(selectedRarity);
  }, [selectedRarity, isLoggedIn]);

  const handleListCard = async () => {
    if (!selectedCard || !listPrice || parseInt(listPrice) < 1) return;
    
    setListingStatus('Listing...');
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_card_id: selectedCard.user_card_id,
          price: parseInt(listPrice),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus('Listed successfully!');
        setSelectedCard(null);
        setListPrice('');
        fetchCards(selectedRarity);
        setTimeout(() => setListingStatus(null), 2000);
      } else {
        setListingStatus(data.error || 'Failed to list');
      }
    } catch {
      setListingStatus('Network error');
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
          <div className="empty-state-icon"><FolderOpen size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">Sign in with Discord to view your card collection.</div>
          <a href="/api/auth/discord?redirect=/collection" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
          </a>
        </div>
      </div>
    );
  }

  // Compute stats
  const rarityCount: Record<string, number> = {};
  cards.forEach(c => {
    rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">My Collection</h1>
        <p className="page-subtitle">{cards.length} card{cards.length !== 1 ? 's' : ''} collected</p>
      </div>

      {/* Rarity stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {RARITIES.slice(1).map(r => (
          <div className="stat-card" key={r} style={{ textAlign: 'center', padding: '0.75rem' }}>
            <div className="stat-label">{r}</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>{rarityCount[r] || 0}</div>
          </div>
        ))}
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

      {listingStatus && (
        <div style={{
          textAlign: 'center', padding: '0.75rem',
          background: listingStatus.includes('success') ? 'var(--accent-green-dim)' : 'rgba(255, 82, 82, 0.1)',
          borderRadius: 'var(--radius-md)',
          color: listingStatus.includes('success') ? 'var(--accent-green)' : 'var(--accent-red)',
          marginBottom: '1rem'
        }}>
          {listingStatus}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Package size={64} /></div>
          <div className="empty-state-title">No Cards Yet</div>
          <div className="empty-state-text">Open packs to start collecting trading cards!</div>
          <a href="/packs" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Open Packs</a>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((card, i) => (
            <TradingCard
              key={`${card.id}-${i}`}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {/* List Card Modal */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Card Details</h3>
              <button className="modal-close" onClick={() => setSelectedCard(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <TradingCard card={selectedCard} />
            </div>

            {!selectedCard.is_listed && (
              <>
                <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  List on Marketplace
                </div>
                <div className="price-input-group" style={{ marginBottom: '1rem' }}>
                  <span className="coin-icon"><Coins size={18} /></span>
                  <input
                    type="number"
                    className="modal-input"
                    placeholder="Set price in coins"
                    value={listPrice}
                    onChange={e => setListPrice(e.target.value)}
                    min={1}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setSelectedCard(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleListCard}
                    disabled={!listPrice || parseInt(listPrice) < 1}
                  >
                    List for Sale
                  </button>
                </div>
              </>
            )}

            {selectedCard.is_listed === 1 && (
              <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Tag size={16} /> This card is currently listed on the marketplace
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
