'use client';

import { useState, useEffect, useRef } from 'react';
import TradingCard from '@/components/TradingCard';
import { ArrowLeftRight, Search, LogIn, ArrowLeft, Plus } from 'lucide-react';

interface CardData {
  id: number;
  card_id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_conf: string | null;
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

interface UserResult {
  id: number;
  csa_id: number | null;
  csa_name: string | null;
  discord_username: string;
  avatar_url: string | null;
}

interface TradeCard extends CardData {
  user_id: number;
}

interface Trade {
  id: number;
  sender_id: number;
  receiver_id: number;
  status: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
  receiver_name: string;
  receiver_avatar: string | null;
  sender_cards: TradeCard[];
  receiver_cards: TradeCard[];
}

export default function TradesPage() {
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'new'>('list');

  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // New trade state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [theirCards, setTheirCards] = useState<CardData[]>([]);
  const [myCards, setMyCards] = useState<CardData[]>([]);
  const [selectedTheirCard, setSelectedTheirCard] = useState<CardData | null>(null);
  const [selectedMyCard, setSelectedMyCard] = useState<CardData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTrades = async () => {
    setTradesLoading(true);
    try {
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (data.trades) setTrades(data.trades);
    } catch { /* ignore */ }
    setTradesLoading(false);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          setUserId(data.user.id);
          // Fetch my unlisted cards
          fetch('/api/collection')
            .then(r => r.json())
            .then(d => {
              if (d.cards) setMyCards((d.cards as CardData[]).filter(c => c.is_listed === 0));
            });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchTrades();
  }, [isLoggedIn]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.users) setSearchResults(data.users);
      } catch { /* ignore */ }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const handleSelectUser = async (user: UserResult) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery('');
    setSelectedTheirCard(null);
    setSelectedMyCard(null);
    try {
      const res = await fetch(`/api/users/${user.id}/collection`);
      const data = await res.json();
      if (data.cards) setTheirCards(data.cards);
    } catch { /* ignore */ }
  };

  const handleSendTrade = async () => {
    if (!selectedUser || !selectedTheirCard || !selectedMyCard) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: selectedUser.id,
          my_card_id: selectedMyCard.id,
          their_card_id: selectedTheirCard.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Trade offer sent!' });
        setView('list');
        setSelectedUser(null);
        setSelectedTheirCard(null);
        setSelectedMyCard(null);
        fetchTrades();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send trade' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    }
    setSubmitting(false);
  };

  const handleAccept = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    const data = await res.json();
    if (data.success) {
      fetchTrades();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to accept trade' });
    }
  };

  const handleDecline = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    });
    const data = await res.json();
    if (data.success) {
      fetchTrades();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to decline trade' });
    }
  };

  const handleCancel = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchTrades();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to cancel trade' });
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
          <div className="empty-state-icon"><ArrowLeftRight size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">Sign in with Discord to send and receive trade offers.</div>
          <a href="/api/auth/discord?redirect=/trades" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
          </a>
        </div>
      </div>
    );
  }

  // ---- New Trade View ----
  if (view === 'new') {
    return (
      <div className="container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">New Trade</h1>
            <p className="page-subtitle">Select a player and cards to trade</p>
          </div>
          <button className="btn btn-secondary" onClick={() => { setView('list'); setSelectedUser(null); setSelectedTheirCard(null); setSelectedMyCard(null); setSearchQuery(''); setSearchResults([]); }}>
            <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Cancel
          </button>
        </div>

        {message && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: 'var(--radius-md)',
            background: message.type === 'success' ? 'rgba(72,199,116,0.1)' : 'rgba(255,82,82,0.1)',
            color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
            border: `1px solid ${message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Step 1: User search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {selectedUser ? `Trading with: ${selectedUser.csa_name || selectedUser.discord_username}` : 'Step 1: Find a player'}
          </div>
          {!selectedUser && (
            <div style={{ position: 'relative', maxWidth: 400 }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by name or CSA ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  marginTop: '0.25rem',
                }}>
                  {searchResults.map(u => (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
                    >
                      {u.avatar_url && (
                        <img src={u.avatar_url} alt={u.discord_username} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {u.csa_name || u.discord_username}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {u.csa_id ? `CSA #${u.csa_id}` : u.discord_username}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedUser && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedUser(null); setTheirCards([]); setSelectedTheirCard(null); }}>
              Change player
            </button>
          )}
        </div>

        {/* Step 2: Their cards */}
        {selectedUser && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Their collection — pick a card you want
            </div>
            {theirCards.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>This player has no available cards.</div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '0.5rem 0' }}>
                {theirCards.map((card, i) => (
                  <div
                    key={`${card.card_id || card.id}-${i}`}
                    onClick={() => setSelectedTheirCard(card)}
                    style={{
                      outline: selectedTheirCard?.id === card.id ? '3px solid var(--accent-blue)' : '3px solid transparent',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'outline 0.1s',
                    }}
                  >
                    <TradingCard
                      card={{ ...card, id: card.card_id || String(card.id) }}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My cards */}
        {selectedUser && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              My collection — pick a card to offer
            </div>
            {myCards.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>You have no available cards to trade.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '0.5rem 0' }}>
                {myCards.map((card, i) => (
                  <div
                    key={`${card.card_id || card.id}-${i}`}
                    onClick={() => setSelectedMyCard(card)}
                    style={{
                      outline: selectedMyCard?.id === card.id ? '3px solid var(--accent-gold)' : '3px solid transparent',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'outline 0.1s',
                    }}
                  >
                    <TradingCard
                      card={{ ...card, id: card.card_id || String(card.id) }}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTheirCard && selectedMyCard && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleSendTrade}
              disabled={submitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowLeftRight size={18} />
              {submitting ? 'Sending...' : 'Send Trade Offer'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- List View ----
  const incoming = trades.filter(t => t.receiver_id === userId);
  const outgoing = trades.filter(t => t.sender_id === userId);

  return (
    <div className="container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Trades</h1>
          <p className="page-subtitle">{trades.length} pending trade{trades.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setView('new'); setMessage(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> New Trade
        </button>
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-md)',
          background: message.type === 'success' ? 'rgba(72,199,116,0.1)' : 'rgba(255,82,82,0.1)',
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        }}>
          {message.text}
        </div>
      )}

      {tradesLoading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : trades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ArrowLeftRight size={64} /></div>
          <div className="empty-state-title">No Pending Trades</div>
          <div className="empty-state-text">Start a new trade to swap cards with other players.</div>
        </div>
      ) : (
        <>
          {/* Incoming trades */}
          {incoming.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Incoming ({incoming.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {incoming.map(trade => (
                  <TradeItem
                    key={trade.id}
                    trade={trade}
                    userId={userId!}
                    onAccept={() => handleAccept(trade.id)}
                    onDecline={() => handleDecline(trade.id)}
                    type="incoming"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Outgoing trades */}
          {outgoing.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Outgoing ({outgoing.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {outgoing.map(trade => (
                  <TradeItem
                    key={trade.id}
                    trade={trade}
                    userId={userId!}
                    onCancel={() => handleCancel(trade.id)}
                    type="outgoing"
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface TradeItemProps {
  trade: Trade;
  userId: number;
  type: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

function TradeItem({ trade, userId, type, onAccept, onDecline, onCancel }: TradeItemProps) {
  const otherName = type === 'incoming' ? trade.sender_name : trade.receiver_name;
  const otherAvatar = type === 'incoming' ? trade.sender_avatar : trade.receiver_avatar;
  const myCards = type === 'incoming' ? trade.receiver_cards : trade.sender_cards;
  const theirCards = type === 'incoming' ? trade.sender_cards : trade.receiver_cards;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      {/* Other user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}>
        {otherAvatar ? (
          <img src={otherAvatar} alt={otherName} style={{ width: 32, height: 32, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {otherName.charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{otherName}</span>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, flexWrap: 'wrap' }}>
        {/* Their cards (what they offer) */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {theirCards.map((card, i) => (
            <TradingCard
              key={`${card.card_id || card.id}-${i}`}
              card={{ ...card, id: card.card_id || String(card.id) }}
              size="small"
            />
          ))}
        </div>

        <ArrowLeftRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        {/* My cards (what I give) */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {myCards.map((card, i) => (
            <TradingCard
              key={`${card.card_id || card.id}-${i}`}
              card={{ ...card, id: card.card_id || String(card.id) }}
              size="small"
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {type === 'incoming' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={onAccept}>Accept</button>
            <button className="btn btn-secondary btn-sm" onClick={onDecline}>Decline</button>
          </>
        )}
        {type === 'outgoing' && (
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </div>
  );
}
