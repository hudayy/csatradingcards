'use client';

import { useState, useEffect } from 'react';
import TradingCard from '@/components/TradingCard';
import { FolderOpen, LogIn, Package, Coins, Tag, Flame } from 'lucide-react';

interface PackHistoryItem {
  id: number;
  pack_type: string;
  opened_at: string;
  cards: { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null; overall_rating: number }[];
}

const SALVAGE_VALUES: Record<string, number> = {
  bronze: 10, silver: 16, gold: 22, platinum: 40,
  diamond: 80, holographic: 267, prismatic: 800,
};

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

const RARITY_COLORS_HEX: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#67e8f9', holographic: '#f472b6', prismatic: '#c084fc',
};

const PACK_DISPLAY: Record<string, { name: string; emoji: string; cls: string }> = {
  standard: { name: 'Challenger Pack', emoji: '⚡', cls: 'standard' },
  elite: { name: 'Elite Pack', emoji: '👑', cls: 'elite' },
  apex: { name: 'Apex Pack', emoji: '💎', cls: 'apex' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function CollectionPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [unlisting, setUnlisting] = useState(false);
  const [salvaging, setSalvaging] = useState(false);
  const [salvageConfirm, setSalvageConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'packs'>('cards');
  const [packHistory, setPackHistory] = useState<PackHistoryItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);

  const fetchCards = async (rarity?: string) => {
    const params = new URLSearchParams();
    if (rarity && rarity !== 'all') params.set('rarity', rarity);
    const res = await fetch(`/api/collection?${params.toString()}`);
    const data = await res.json();
    if (data.cards) setCards(data.cards);
  };

  const fetchAllCards = async () => {
    const res = await fetch('/api/collection');
    const data = await res.json();
    if (data.cards) setAllCards(data.cards);
  };

  const fetchPackHistory = async () => {
    setPacksLoading(true);
    const res = await fetch('/api/collection/packs');
    const data = await res.json();
    if (data.packs) setPackHistory(data.packs);
    setPacksLoading(false);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          fetchPackHistory();
          Promise.all([fetchCards(), fetchAllCards()]).then(() => setLoading(false));
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
        fetchAllCards();
        setTimeout(() => setListingStatus(null), 2000);
      } else {
        setListingStatus(data.error || 'Failed to list');
      }
    } catch {
      setListingStatus('Network error');
    }
  };

  const handleUnlistCard = async () => {
    if (!selectedCard) return;
    setUnlisting(true);
    try {
      const res = await fetch('/api/marketplace', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: selectedCard.user_card_id }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus('Unlisted successfully!');
        setSelectedCard(null);
        fetchCards(selectedRarity);
        fetchAllCards();
        setTimeout(() => setListingStatus(null), 2000);
      } else {
        setListingStatus(data.error || 'Failed to unlist');
      }
    } catch {
      setListingStatus('Network error');
    }
    setUnlisting(false);
  };

  const handleSalvage = async () => {
    if (!selectedCard) return;
    setSalvaging(true);
    try {
      const res = await fetch('/api/collection/salvage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: selectedCard.user_card_id }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus(`Salvaged for ${data.coins} coins!`);
        setSelectedCard(null);
        setSalvageConfirm(false);
        fetchCards(selectedRarity);
        fetchAllCards();
        setTimeout(() => setListingStatus(null), 2500);
      } else {
        setListingStatus(data.error || 'Salvage failed');
      }
    } catch {
      setListingStatus('Network error');
    }
    setSalvaging(false);
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

  // Compute stats from unfiltered allCards so counts never change on filter
  const rarityCount: Record<string, number> = {};
  allCards.forEach(c => {
    rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">My Collection</h1>
        <p className="page-subtitle">{allCards.length} card{allCards.length !== 1 ? 's' : ''} collected</p>
      </div>

      {/* Tab switcher */}
      <div className="collection-tabs">
        <button className={`collection-tab${activeTab === 'cards' ? ' active' : ''}`} onClick={() => setActiveTab('cards')}>
          Cards
        </button>
        <button className={`collection-tab${activeTab === 'packs' ? ' active' : ''}`} onClick={() => { setActiveTab('packs'); if (!packHistory.length) fetchPackHistory(); }}>
          Pack History
        </button>
      </div>

      {activeTab === 'cards' && (
        <>
          {/* Rarity filter stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {RARITIES.map(r => (
              <div
                key={r}
                className="stat-card"
                onClick={() => setSelectedRarity(r)}
                style={{
                  textAlign: 'center',
                  padding: '0.75rem 0.25rem',
                  cursor: 'pointer',
                  outline: selectedRarity === r ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  transition: 'outline 0.15s',
                }}
              >
                <div className="stat-label">{r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}</div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {r === 'all' ? allCards.length : (rarityCount[r] || 0)}
                </div>
              </div>
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
        </>
      )}

      {activeTab === 'packs' && (
        <>
          {packsLoading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : packHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Package size={64} /></div>
              <div className="empty-state-title">No Packs Opened Yet</div>
              <div className="empty-state-text">Open packs to see your history here.</div>
              <a href="/packs" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Open Free Packs</a>
            </div>
          ) : (
            <>
              <div className="pack-hist-summary">
                {(['all', 'standard', 'elite', 'apex'] as const).map(t => (
                  <div className="stat-card" key={t} style={{ textAlign: 'center' }}>
                    <div className="stat-label">{t === 'all' ? 'Total' : PACK_DISPLAY[t]?.name.replace(' Pack', '')}</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                      {t === 'all' ? packHistory.length : packHistory.filter(p => p.pack_type === t).length}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pack-hist-grid">
                {packHistory.map(pack => {
                  const disp = PACK_DISPLAY[pack.pack_type] ?? { name: pack.pack_type, emoji: '📦', cls: 'standard' };
                  return (
                    <div key={pack.id} className="pack-hist-row">
                      <div className={`pack-hist-thumb pack-hist-thumb-${disp.cls}`}>{disp.emoji}</div>
                      <div className="pack-hist-info">
                        <div className="pack-hist-type">{disp.name}</div>
                        <div className="pack-hist-time">{formatRelativeTime(pack.opened_at)}</div>
                        <div className="pack-hist-pips">
                          {pack.cards.map((card, i) => (
                            <div
                              key={i}
                              className="pack-hist-pip"
                              style={{ background: RARITY_COLORS_HEX[card.rarity] ?? '#888', boxShadow: `0 0 5px ${RARITY_COLORS_HEX[card.rarity] ?? '#888'}88` }}
                              title={`${card.player_name} · ${card.rarity} · ${card.overall_rating} OVR`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* List Card Modal */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Card Details</h3>
              <button className="modal-close" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>×</button>
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
                <div className="modal-actions" style={{ marginBottom: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>
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

                {/* Salvage section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                  {!salvageConfirm ? (
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#f97316' }}
                      onClick={() => setSalvageConfirm(true)}
                    >
                      <Flame size={15} /> Salvage for {SALVAGE_VALUES[selectedCard.rarity] ?? 10} coins
                    </button>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        This will permanently destroy the card. Are you sure?
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button className="btn btn-secondary" onClick={() => setSalvageConfirm(false)}>No, keep it</button>
                        <button className="btn btn-danger" onClick={handleSalvage} disabled={salvaging}>
                          {salvaging ? 'Salvaging...' : 'Yes, salvage it'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedCard.is_listed === 1 && (
              <div>
                <div style={{ textAlign: 'center', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <Tag size={16} /> Listed on marketplace
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setSelectedCard(null)}>Close</button>
                  <button className="btn btn-danger" onClick={handleUnlistCard} disabled={unlisting}>
                    {unlisting ? 'Unlisting...' : 'Remove Listing'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
