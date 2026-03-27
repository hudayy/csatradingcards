'use client';

import React, { useState, useEffect, useRef } from 'react';
import TradingCard from '@/components/TradingCard';
import { FolderOpen, LogIn, Package, Coins, Tag, Flame, ChevronLeft, Layers, ArrowUp, Store, Star, Search, SortAsc } from 'lucide-react';

interface InventoryPack {
  id: number;
  pack_type: string;
  granted_at: string;
}

interface PackHistoryItem {
  id: number;
  pack_type: string;
  opened_at: string;
  cards: { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null }[];
}

const SALVAGE_VALUES: Record<string, number> = {
  bronze: 6, silver: 10, gold: 15, platinum: 28,
  diamond: 60, holographic: 220, prismatic: 600,
};

interface CardData {
  id: string;
  user_card_id?: number;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_logo_url?: string | null;
  franchise_color?: string | null;
  franchise_conf?: string | null;
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
  copy_count: number;
}

const RARITIES = ['all', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

const RARITY_COLORS_HEX: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#67e8f9', holographic: '#f472b6', prismatic: '#c084fc',
};

const PACK_DISPLAY: Record<string, { name: string; emoji: string; cls: string }> = {
  standard: { name: 'Challenger Pack', emoji: '⚡', cls: 'standard' },
  elite:    { name: 'Prestige Pack',   emoji: '👑', cls: 'elite' },
  apex:     { name: 'Apex Pack',       emoji: '💎', cls: 'apex' },
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
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rarity');
  const [cardType, setCardType] = useState('all');
  const [rarityCounts, setRarityCounts] = useState<Record<string, number>>({});
  const [totalCards, setTotalCards] = useState(0);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [unlisting, setUnlisting] = useState(false);
  const [salvaging, setSalvaging] = useState(false);
  const [salvageConfirm, setSalvageConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'packs'>('cards');
  const [inventory, setInventory] = useState<InventoryPack[]>([]);
  const [packHistory, setPackHistory] = useState<PackHistoryItem[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  // Reveal state for opening inventory packs
  const [revealCards, setRevealCards] = useState<CardData[] | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [openingId, setOpeningId] = useState<number | null>(null);
  // Bulk salvage
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkSalvaging, setBulkSalvaging] = useState(false);
  // Bulk list
  const [bulkListMode, setBulkListMode] = useState(false);
  const [bulkListSelected, setBulkListSelected] = useState<Set<number>>(new Set());
  const [bulkListPrices, setBulkListPrices] = useState<Record<string, string>>({});
  const [bulkListing, setBulkListing] = useState(false);
  // Trade up
  const [tradeUpMode, setTradeUpMode] = useState(false);
  const [tradeUpSelected, setTradeUpSelected] = useState<Set<number>>(new Set());
  const [tradeUpLoading, setTradeUpLoading] = useState(false);
  const [tradeUpResult, setTradeUpResult] = useState<{ card: CardData; traded_rarity: string; received_rarity: string } | null>(null);
  // Showcase
  const [showcasePosition, setShowcasePosition] = useState<number>(1);
  const [addingToShowcase, setAddingToShowcase] = useState(false);
  const [showcaseAddMsg, setShowcaseAddMsg] = useState<string | null>(null);

  const fetchCards = async (opts?: { rarity?: string; search?: string; sort?: string; cardType?: string }) => {
    const params = new URLSearchParams();
    if (opts?.rarity && opts.rarity !== 'all') params.set('rarity', opts.rarity);
    if (opts?.search) params.set('search', opts.search);
    if (opts?.sort && opts.sort !== 'rarity') params.set('sort', opts.sort);
    if (opts?.cardType && opts.cardType !== 'all') params.set('card_type', opts.cardType);
    const res = await fetch(`/api/collection?${params.toString()}`);
    const data = await res.json();
    if (data.cards) setCards(data.cards);
    if (data.rarityCounts) {
      const counts: Record<string, number> = {};
      for (const { rarity, count } of data.rarityCounts) counts[rarity] = count;
      setRarityCounts(counts);
    }
    if (typeof data.totalCards === 'number') setTotalCards(data.totalCards);
  };

  const fetchPackData = async () => {
    setPacksLoading(true);
    const res = await fetch('/api/collection/packs');
    const data = await res.json();
    if (data.inventory) setInventory(data.inventory);
    if (data.packs) setPackHistory(data.packs);
    setPacksLoading(false);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          fetchPackData();
          fetchCards({ rarity: 'all' }).then(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
  }, [selectedRarity, search, sortBy, cardType, isLoggedIn]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(searchInput), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

  const handleOpenInventoryPack = async (inventoryId: number) => {
    setOpeningId(inventoryId);
    try {
      const res = await fetch('/api/packs/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_id: inventoryId }),
      });
      const data = await res.json();
      if (!res.ok) { setOpeningId(null); return; }
      setRevealCards(data.cards);
      setFlippedCards(new Set());
      setInventory(inv => inv.filter(p => p.id !== inventoryId));
    } catch { /* ignore */ }
    setOpeningId(null);
  };

  const handleListCard = async () => {
    if (!selectedCard || !listPrice || parseInt(listPrice) < 1) return;
    setListingStatus('Listing...');
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: selectedCard.user_card_id, price: parseInt(listPrice) }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus('Listed successfully!');
        setSelectedCard(null); setListPrice('');
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
        setTimeout(() => setListingStatus(null), 2000);
      } else {
        setListingStatus(data.error || 'Failed to list');
      }
    } catch { setListingStatus('Network error'); }
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
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
        setTimeout(() => setListingStatus(null), 2000);
      } else {
        setListingStatus(data.error || 'Failed to unlist');
      }
    } catch { setListingStatus('Network error'); }
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
        if (data.new_balance !== undefined) window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.new_balance } }));
        setSelectedCard(null); setSalvageConfirm(false);
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
        setTimeout(() => setListingStatus(null), 2500);
      } else {
        setListingStatus(data.error || 'Salvage failed');
      }
    } catch { setListingStatus('Network error'); }
    setSalvaging(false);
  };

  const handleBulkSalvage = async () => {
    if (bulkSelected.size === 0 || bulkSalvaging) return;
    setBulkSalvaging(true);
    try {
      const res = await fetch('/api/collection/salvage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_ids: Array.from(bulkSelected) }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus(`Salvaged ${data.count} card${data.count !== 1 ? 's' : ''} for ${data.coins} coins!`);
        if (data.new_balance !== undefined) window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.new_balance } }));
        setBulkSelected(new Set());
        setBulkMode(false);
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
        setTimeout(() => setListingStatus(null), 2500);
      } else {
        setListingStatus(data.error || 'Bulk salvage failed');
      }
    } catch { setListingStatus('Network error'); }
    setBulkSalvaging(false);
  };

  const handleBulkList = async () => {
    if (bulkListSelected.size === 0 || bulkListing) return;
    const items = Array.from(bulkListSelected).map(ucId => {
      const card = cards.find(c => c.user_card_id === ucId)!;
      const price = parseInt(bulkListPrices[card.rarity] || '0');
      return { user_card_id: ucId, price };
    }).filter(i => i.price >= 1);
    if (items.length === 0) { setListingStatus('Set a price for at least one rarity'); return; }
    setBulkListing(true);
    try {
      const res = await fetch('/api/marketplace/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setListingStatus(`Listed ${data.listed} card${data.listed !== 1 ? 's' : ''}!`);
        setBulkListSelected(new Set()); setBulkListMode(false); setBulkListPrices({});
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
        setTimeout(() => setListingStatus(null), 2500);
      } else { setListingStatus(data.error || 'Bulk listing failed'); }
    } catch { setListingStatus('Network error'); }
    setBulkListing(false);
  };

  const handleTradeUp = async () => {
    if (tradeUpSelected.size !== 5 || tradeUpLoading) return;
    setTradeUpLoading(true);
    try {
      const res = await fetch('/api/collection/trade-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_ids: Array.from(tradeUpSelected) }),
      });
      const data = await res.json();
      if (data.success) {
        setTradeUpResult({ card: data.card, traded_rarity: data.traded_rarity, received_rarity: data.received_rarity });
        setTradeUpSelected(new Set()); setTradeUpMode(false);
        fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType });
      } else { setListingStatus(data.error || 'Trade-up failed'); setTimeout(() => setListingStatus(null), 3000); }
    } catch { setListingStatus('Network error'); }
    setTradeUpLoading(false);
  };

  const handleAddToShowcase = async () => {
    if (!selectedCard?.user_card_id || addingToShowcase) return;
    setAddingToShowcase(true);
    try {
      const res = await fetch('/api/profile/showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_card_id: selectedCard.user_card_id, position: showcasePosition }),
      });
      const data = await res.json();
      if (data.success) {
        setShowcaseAddMsg(`Added to display case slot ${showcasePosition}!`);
      } else {
        setShowcaseAddMsg(data.error || 'Failed to add to showcase');
      }
    } catch {
      setShowcaseAddMsg('Network error');
    }
    setAddingToShowcase(false);
    setTimeout(() => setShowcaseAddMsg(null), 3000);
  };

  if (loading) {
    return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;
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

  const rarityCount = rarityCounts;

  const bulkTotalCoins = Array.from(bulkSelected).reduce((sum, ucId) => {
    const card = cards.find(c => c.user_card_id === ucId);
    return sum + (card ? (SALVAGE_VALUES[card.rarity] ?? 10) : 0);
  }, 0);

  // Trade-up helpers
  const tradeUpRarity = tradeUpSelected.size > 0
    ? cards.find(c => c.user_card_id === Array.from(tradeUpSelected)[0])?.rarity ?? null
    : null;
  const RARITY_UPGRADE: Record<string, string> = { bronze: 'silver', silver: 'gold', gold: 'platinum', platinum: 'diamond', diamond: 'holographic', holographic: 'prismatic' };
  const bulkListRarities = [...new Set(Array.from(bulkListSelected).map(ucId => cards.find(c => c.user_card_id === ucId)?.rarity).filter(Boolean) as string[])];

  // Group inventory by pack_type for display
  const inventoryByType = inventory.reduce<Record<string, InventoryPack[]>>((acc, p) => {
    if (!acc[p.pack_type]) acc[p.pack_type] = [];
    acc[p.pack_type].push(p);
    return acc;
  }, {});

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">My Collection</h1>
        <p className="page-subtitle">{totalCards} card{totalCards !== 1 ? 's' : ''} collected</p>
      </div>

      {/* Tab switcher */}
      <div className="collection-tabs">
        <button className={`collection-tab${activeTab === 'cards' ? ' active' : ''}`} onClick={() => setActiveTab('cards')}>
          Cards
        </button>
        <button className={`collection-tab${activeTab === 'packs' ? ' active' : ''}`} onClick={() => { setActiveTab('packs'); if (!packHistory.length && !inventory.length) fetchPackData(); }}>
          Packs {inventory.length > 0 && <span className="inv-badge">{inventory.length}</span>}
        </button>
      </div>

      {/* ---- Cards tab ---- */}
      {activeTab === 'cards' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(bulkMode || bulkListMode || tradeUpMode) && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {bulkMode && `${bulkSelected.size} selected`}
                {bulkListMode && `${bulkListSelected.size} selected`}
                {tradeUpMode && `${tradeUpSelected.size}/5 selected${tradeUpRarity ? ` (${tradeUpRarity})` : ''}`}
              </span>
            )}
            <button
              className={`btn btn-sm${bulkMode ? ' btn-danger' : ' btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
              onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); setBulkListMode(false); setBulkListSelected(new Set()); setTradeUpMode(false); setTradeUpSelected(new Set()); }}
            >
              <Layers size={14} /> {bulkMode ? 'Cancel' : 'Bulk Salvage'}
            </button>
            <button
              className={`btn btn-sm${bulkListMode ? ' btn-danger' : ' btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
              onClick={() => { setBulkListMode(m => !m); setBulkListSelected(new Set()); setBulkMode(false); setBulkSelected(new Set()); setTradeUpMode(false); setTradeUpSelected(new Set()); }}
            >
              <Store size={14} /> {bulkListMode ? 'Cancel' : 'Bulk List'}
            </button>
            <button
              className={`btn btn-sm${tradeUpMode ? ' btn-danger' : ' btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
              onClick={() => { setTradeUpMode(m => !m); setTradeUpSelected(new Set()); setBulkMode(false); setBulkSelected(new Set()); setBulkListMode(false); setBulkListSelected(new Set()); }}
            >
              <ArrowUp size={14} /> {tradeUpMode ? 'Cancel' : 'Trade Up (5→1)'}
            </button>
          </div>
          {/* Search, sort, card type filters */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search by name…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem 0.4rem 2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="rarity">Rarity (High→Low)</option>
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['all', 'player', 'gm'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCardType(t)}
                  className={`btn btn-sm ${cardType === t ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                >
                  {t === 'all' ? 'All' : t === 'player' ? 'Players' : 'GMs'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {RARITIES.map(r => (
              <div
                key={r}
                className="stat-card"
                onClick={() => setSelectedRarity(r)}
                style={{
                  textAlign: 'center', padding: '0.75rem 0.25rem', cursor: 'pointer',
                  outline: selectedRarity === r ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  transition: 'outline 0.15s',
                }}
              >
                <div className="stat-label">{r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}</div>
                <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {r === 'all' ? totalCards : (rarityCount[r] || 0)}
                </div>
              </div>
            ))}
          </div>

          {listingStatus && (
            <div style={{
              textAlign: 'center', padding: '0.75rem',
              background: listingStatus.includes('success') || listingStatus.includes('coins') ? 'var(--accent-green-dim)' : 'rgba(255, 82, 82, 0.1)',
              borderRadius: 'var(--radius-md)',
              color: listingStatus.includes('success') || listingStatus.includes('coins') ? 'var(--accent-green)' : 'var(--accent-red)',
              marginBottom: '1rem',
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
              {cards.map((card, i) => {
                const ucId = card.user_card_id!;
                if (bulkMode) {
                  const isSelected = bulkSelected.has(ucId);
                  const canSelect = !card.is_listed;
                  return (
                    <div key={`${card.id}-${i}`} className={`card-select-wrapper${isSelected ? ' selected' : ''}${!canSelect ? ' unlisted' : ''}`}
                      onClick={() => { if (!canSelect) return; setBulkSelected(prev => { const n = new Set(prev); if (n.has(ucId)) n.delete(ucId); else n.add(ucId); return n; }); }}>
                      <TradingCard card={card} />
                    </div>
                  );
                }
                if (bulkListMode) {
                  const isSelected = bulkListSelected.has(ucId);
                  const canSelect = !card.is_listed;
                  return (
                    <div key={`${card.id}-${i}`} className={`card-select-wrapper${isSelected ? ' selected' : ''}${!canSelect ? ' unlisted' : ''}`}
                      onClick={() => { if (!canSelect) return; setBulkListSelected(prev => { const n = new Set(prev); if (n.has(ucId)) n.delete(ucId); else n.add(ucId); return n; }); }}>
                      <TradingCard card={card} />
                    </div>
                  );
                }
                if (tradeUpMode) {
                  const isSelected = tradeUpSelected.has(ucId);
                  const wrongRarity = tradeUpRarity !== null && card.rarity !== tradeUpRarity;
                  const maxReached = tradeUpSelected.size >= 5 && !isSelected;
                  const isPrismatic = card.rarity === 'prismatic';
                  const canSelect = !card.is_listed && !wrongRarity && !maxReached && !isPrismatic;
                  return (
                    <div key={`${card.id}-${i}`} className={`card-select-wrapper${isSelected ? ' selected' : ''}${!canSelect ? ' unlisted' : ''}`}
                      onClick={() => { if (!canSelect) return; setTradeUpSelected(prev => { const n = new Set(prev); if (n.has(ucId)) n.delete(ucId); else n.add(ucId); return n; }); }}>
                      <TradingCard card={card} />
                    </div>
                  );
                }
                return <TradingCard key={`${card.id}-${i}`} card={card} onClick={() => { setSelectedCard(card); setShowcasePosition(1); setShowcaseAddMsg(null); setSalvageConfirm(false); setListPrice(''); }} />;
              })}
            </div>
          )}
        </>
      )}

      {/* ---- Packs tab ---- */}
      {activeTab === 'packs' && (
        <>
          {packsLoading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : revealCards ? (
            /* ---- Pack reveal ---- */
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Orbitron, sans-serif', marginBottom: '0.4rem' }}>Pack Opened!</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {flippedCards.size < revealCards.length
                    ? `${revealCards.length - flippedCards.size} card${revealCards.length - flippedCards.size !== 1 ? 's' : ''} left — click to flip`
                    : 'All cards revealed!'}
                </p>
                {flippedCards.size < revealCards.length && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                    onClick={() => setFlippedCards(new Set(revealCards.map((_, i) => i)))}
                  >
                    Reveal All
                  </button>
                )}
              </div>
              <div className="pack-reveal" style={{ marginBottom: '2rem' }}>
                {revealCards.map((card, i) => (
                  <div
                    key={card.id}
                    className={`card-flip-wrapper${flippedCards.has(i) ? ' is-flipped' : ''}`}
                    style={{ '--flip-delay': `${i * 0.08}s` } as React.CSSProperties}
                    onClick={() => { if (!flippedCards.has(i)) setFlippedCards(prev => new Set([...prev, i])); }}
                  >
                    <div className="card-flip-inner">
                      <div className="card-back">
                        <img src="/csacardslogo.png" alt="CSA Cards" className="card-back-logo" />
                        <div className="card-back-label">CSA Cards</div>
                        <div className="card-back-hint">Click to reveal</div>
                      </div>
                      <div className="card-face"><TradingCard card={card} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <button
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => { setRevealCards(null); setFlippedCards(new Set()); fetchPackData(); fetchCards({ rarity: selectedRarity, search, sort: sortBy, cardType }); }}
                >
                  <ChevronLeft size={16} /> Back to Packs
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ---- Inventory ---- */}
              {inventory.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pack Inventory
                  </h3>
                  <div className="inv-grid">
                    {(Object.entries(inventoryByType) as [string, InventoryPack[]][]).map(([packType, packs]) => {
                      const disp = PACK_DISPLAY[packType] ?? { name: packType, emoji: '📦', cls: 'standard' };
                      return (
                        <div key={packType} className={`inv-card inv-card-${disp.cls}`}>
                          <div className={`pack-hist-thumb pack-hist-thumb-${disp.cls}`} style={{ width: 52, height: 78, fontSize: '1.8rem' }}>{disp.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{disp.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>
                              {packs.length} pack{packs.length !== 1 ? 's' : ''} available
                            </div>
                          </div>
                          <button
                            className={`btn inv-open-btn inv-open-${disp.cls}`}
                            disabled={openingId !== null}
                            onClick={() => handleOpenInventoryPack(packs[0].id)}
                          >
                            {openingId === packs[0].id ? 'Opening...' : 'Open'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- Opening history ---- */}
              <h3 style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Opening History
              </h3>

              {packHistory.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-state-icon"><Package size={48} /></div>
                  <div className="empty-state-title">No Packs Opened Yet</div>
                  <div className="empty-state-text">Open packs to see your history here.</div>
                  <a href="/packs" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Open Free Packs</a>
                </div>
              ) : (
                <>
                  <div className="pack-hist-summary" style={{ marginBottom: '1.5rem' }}>
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
                                  title={`${card.player_name} · ${card.rarity}`}
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
        </>
      )}

      {/* ---- Bulk salvage bar ---- */}
      {bulkMode && (
        <div className="bulk-salvage-bar">
          <span className="bulk-salvage-info">
            <Layers size={16} />
            {bulkSelected.size > 0
              ? `${bulkSelected.size} card${bulkSelected.size !== 1 ? 's' : ''} · ${bulkTotalCoins.toLocaleString()} coins`
              : 'Select cards to salvage'}
          </span>
          <button className="btn bulk-salvage-btn" disabled={bulkSelected.size === 0 || bulkSalvaging} onClick={handleBulkSalvage}>
            <Flame size={15} />
            {bulkSalvaging ? 'Salvaging...' : `Salvage for ${bulkTotalCoins.toLocaleString()} Coins`}
          </button>
        </div>
      )}

      {/* ---- Bulk list bar ---- */}
      {bulkListMode && (
        <div className="bulk-salvage-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Store size={16} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {bulkListSelected.size > 0 ? `${bulkListSelected.size} cards selected` : 'Select cards to list'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>— Set a price per rarity tier below</span>
          </div>
          {bulkListRarities.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {bulkListRarities.map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', color: RARITY_COLORS_HEX[r] || 'var(--text-primary)' }}>{r}</span>
                  <Coins size={12} style={{ color: 'var(--accent-gold)' }} />
                  <input
                    type="number" min={1} placeholder="price"
                    value={bulkListPrices[r] || ''}
                    onChange={e => setBulkListPrices(p => ({ ...p, [r]: e.target.value }))}
                    style={{ width: 80, padding: '0.15rem 0.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={bulkListSelected.size === 0 || bulkListing} onClick={handleBulkList} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Store size={15} />
              {bulkListing ? 'Listing...' : `List ${bulkListSelected.size} Cards`}
            </button>
          </div>
        </div>
      )}

      {/* ---- Trade-up bar ---- */}
      {tradeUpMode && (
        <div className="bulk-salvage-bar" style={{ background: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.4)' }}>
          <span className="bulk-salvage-info" style={{ color: 'var(--text-primary)' }}>
            <ArrowUp size={16} />
            {tradeUpSelected.size === 0
              ? 'Select 5 cards of the same rarity to trade up'
              : tradeUpSelected.size < 5
              ? `${tradeUpSelected.size}/5 ${tradeUpRarity} cards selected`
              : `5 ${tradeUpRarity} cards → 1 ${RARITY_UPGRADE[tradeUpRarity!] || '?'} card`}
          </span>
          <button
            className="btn"
            style={{ background: 'rgba(124,58,237,0.8)', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            disabled={tradeUpSelected.size !== 5 || tradeUpLoading}
            onClick={handleTradeUp}
          >
            <ArrowUp size={15} />
            {tradeUpLoading ? 'Trading Up...' : `Trade Up`}
          </button>
        </div>
      )}

      {/* ---- Trade-up result ---- */}
      {tradeUpResult && (
        <div className="modal-overlay" onClick={() => setTradeUpResult(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-header">
              <h3 className="modal-title">Trade Up Complete!</h3>
              <button className="modal-close" onClick={() => setTradeUpResult(null)}>×</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Traded 5 <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{tradeUpResult.traded_rarity}</span> cards for a{' '}
              <span style={{ textTransform: 'capitalize', fontWeight: 700, color: RARITY_COLORS_HEX[tradeUpResult.received_rarity] || 'var(--accent-gold)' }}>{tradeUpResult.received_rarity}</span> card!
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <TradingCard card={tradeUpResult.card} />
            </div>
            <button className="btn btn-primary" onClick={() => setTradeUpResult(null)}>Nice!</button>
          </div>
        </div>
      )}

      {/* ---- Card detail modal ---- */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Card Details</h3>
              <button className="modal-close" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>×</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <TradingCard card={selectedCard} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.75rem' }}>
                {selectedCard.copy_count === 1
                  ? '✦ Only 1 copy exists'
                  : `${selectedCard.copy_count} copies exist across all collections`}
              </span>
            </div>

            {!selectedCard.is_listed && (
              <>
                <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>List on Marketplace</div>
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
                  <button className="btn btn-secondary" onClick={() => { setSelectedCard(null); setSalvageConfirm(false); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleListCard} disabled={!listPrice || parseInt(listPrice) < 1}>List for Sale</button>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Star size={15} style={{ color: 'var(--accent-gold)' }} /> Add to Display Case
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    {[1, 2, 3, 4, 5].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setShowcasePosition(pos)}
                        style={{
                          flex: 1, padding: '0.35rem', borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${showcasePosition === pos ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                          background: showcasePosition === pos ? 'rgba(250,204,21,0.15)' : 'var(--bg-secondary)',
                          color: showcasePosition === pos ? 'var(--accent-gold)' : 'var(--text-muted)',
                          cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        }}
                      >{pos}</button>
                    ))}
                  </div>
                  {showcaseAddMsg && (
                    <div style={{ fontSize: '0.8rem', color: showcaseAddMsg.includes('!') ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '0.5rem' }}>
                      {showcaseAddMsg}
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={handleAddToShowcase}
                    disabled={addingToShowcase}
                  >
                    <Star size={14} /> {addingToShowcase ? 'Adding...' : `Feature in Slot ${showcasePosition}`}
                  </button>
                </div>

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
