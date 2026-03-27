'use client';

import { useState, useEffect, useRef } from 'react';
import TradingCard from '@/components/TradingCard';
import { ArrowLeftRight, Search, LogIn, X, Check, Coins } from 'lucide-react';

interface CardData {
  id: string;
  user_card_id: number;
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

interface TradeCard extends CardData { user_id: number; }

interface Trade {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_coins: number;
  receiver_coins: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  sender_name: string;
  sender_avatar: string | null;
  receiver_name: string;
  receiver_avatar: string | null;
  sender_cards: TradeCard[];
  receiver_cards: TradeCard[];
}

function SelectableCard({ card, selected, color, onClick }: { card: CardData; selected: boolean; color: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)',
        outline: selected ? `3px solid ${color}` : '3px solid transparent',
        zIndex: 2, pointerEvents: 'none', transition: 'outline 0.1s',
      }} />
      {selected && (
        <div style={{
          position: 'absolute', top: 6, right: 6, zIndex: 3,
          background: color, borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}>
          <Check size={13} color="#000" strokeWidth={3} />
        </div>
      )}
      <TradingCard card={card} size="small" />
    </div>
  );
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
  const [selectedTheirCards, setSelectedTheirCards] = useState<Set<number>>(new Set());
  const [selectedMyCards, setSelectedMyCards] = useState<Set<number>>(new Set());
  const [myCoins, setMyCoins] = useState('');
  const [theirCoins, setTheirCoins] = useState('');
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
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.user) {
        setIsLoggedIn(true);
        setUserId(data.user.id);
        fetch('/api/collection').then(r => r.json()).then(d => {
          if (d.cards) setMyCards((d.cards as CardData[]).filter(c => c.is_listed === 0));
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (isLoggedIn) fetchTrades(); }, [isLoggedIn]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.users) setSearchResults(data.users);
      } catch { /* ignore */ }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const handleSelectUser = async (user: UserResult) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery('');
    setSelectedTheirCards(new Set());
    setSelectedMyCards(new Set());
    try {
      const res = await fetch(`/api/users/${user.id}/collection`);
      const data = await res.json();
      if (data.cards) setTheirCards(data.cards);
    } catch { /* ignore */ }
  };

  const toggleTheirCard = (card: CardData) => {
    setSelectedTheirCards(prev => {
      const next = new Set(prev);
      if (next.has(card.user_card_id)) next.delete(card.user_card_id);
      else next.add(card.user_card_id);
      return next;
    });
  };

  const toggleMyCard = (card: CardData) => {
    setSelectedMyCards(prev => {
      const next = new Set(prev);
      if (next.has(card.user_card_id)) next.delete(card.user_card_id);
      else next.add(card.user_card_id);
      return next;
    });
  };

  const handleSendTrade = async () => {
    if (!selectedUser || !selectedTheirCards.size || !selectedMyCards.size) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: selectedUser.id,
          my_card_ids: Array.from(selectedMyCards),
          their_card_ids: Array.from(selectedTheirCards),
          my_coins: parseInt(myCoins) || 0,
          their_coins: parseInt(theirCoins) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setView('list');
        setSelectedUser(null);
        setSelectedTheirCards(new Set());
        setSelectedMyCards(new Set());
        setMyCoins('');
        setTheirCoins('');
        fetchTrades();
        setMessage({ type: 'success', text: 'Trade offer sent!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send trade' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    }
    setSubmitting(false);
  };

  const handleAccept = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept' }) });
    const data = await res.json();
    if (data.success) fetchTrades();
    else setMessage({ type: 'error', text: data.error || 'Failed to accept trade' });
  };

  const handleDecline = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline' }) });
    const data = await res.json();
    if (data.success) fetchTrades();
    else setMessage({ type: 'error', text: data.error || 'Failed to decline trade' });
  };

  const handleCancel = async (tradeId: number) => {
    const res = await fetch(`/api/trades/${tradeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) fetchTrades();
    else setMessage({ type: 'error', text: data.error || 'Failed to cancel trade' });
  };

  const resetNewTrade = () => {
    setView('list');
    setSelectedUser(null);
    setTheirCards([]);
    setSelectedTheirCards(new Set());
    setSelectedMyCards(new Set());
    setMyCoins('');
    setTheirCoins('');
    setSearchQuery('');
    setSearchResults([]);
  };

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

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

  const incoming = trades.filter(t => t.receiver_id === userId);
  const outgoing = trades.filter(t => t.sender_id === userId);
  const selectedTheirList = theirCards.filter(c => selectedTheirCards.has(c.user_card_id));
  const selectedMyList = myCards.filter(c => selectedMyCards.has(c.user_card_id));
  const myCoinsNum = parseInt(myCoins) || 0;
  const theirCoinsNum = parseInt(theirCoins) || 0;
  const canSend = !!selectedUser && (selectedMyCards.size > 0 || myCoinsNum > 0) && (selectedTheirCards.size > 0 || theirCoinsNum > 0);

  return (
    <div className="container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">{view === 'new' ? 'New Trade' : 'Trades'}</h1>
          <p className="page-subtitle">
            {view === 'new'
              ? (selectedUser ? `Offering to ${selectedUser.csa_name || selectedUser.discord_username}` : 'Search for a player to trade with')
              : `${trades.length} pending trade${trades.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {view === 'list' ? (
          <button className="btn btn-primary" onClick={() => { setView('new'); setMessage(null); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={16} /> New Trade
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={resetNewTrade} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <X size={16} /> Cancel
          </button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-md)',
          background: message.type === 'success' ? 'rgba(72,199,116,0.1)' : 'rgba(255,82,82,0.1)',
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        }}>
          {message.text}
        </div>
      )}

      {/* ── NEW TRADE VIEW ── */}
      {view === 'new' && (
        <div>
          {/* User search */}
          {!selectedUser ? (
            <div style={{ maxWidth: 420, marginBottom: '2rem', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search player by name or CSA ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '0.7rem 0.75rem 0.7rem 2.25rem',
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                    fontSize: '0.95rem', boxSizing: 'border-box',
                  }}
                />
              </div>
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem',
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', zIndex: 20,
                }}>
                  {searchResults.map(u => (
                    <div key={u.id} onClick={() => handleSelectUser(u)} style={{
                      padding: '0.65rem 0.85rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-subtle)',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
                    >
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                        : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>{(u.csa_name || u.discord_username).charAt(0).toUpperCase()}</div>
                      }
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{u.csa_name || u.discord_username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.csa_id ? `CSA #${u.csa_id}` : u.discord_username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Card selection panels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Their cards */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {selectedUser.csa_name || selectedUser.discord_username}&apos;s Cards
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to request — {selectedTheirCards.size} selected</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedUser(null); setTheirCards([]); setSelectedTheirCards(new Set()); }}>
                      Change
                    </button>
                  </div>
                  <div style={{ padding: '0.75rem', overflowY: 'auto', maxHeight: 380, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start' }}>
                    {theirCards.length === 0
                      ? <div style={{ color: 'var(--text-muted)', padding: '1rem', width: '100%', textAlign: 'center' }}>No available cards</div>
                      : theirCards.map(card => (
                        <SelectableCard
                          key={card.user_card_id}
                          card={card}
                          selected={selectedTheirCards.has(card.user_card_id)}
                          color="var(--accent-blue)"
                          onClick={() => toggleTheirCard(card)}
                        />
                      ))
                    }
                  </div>
                </div>

                {/* My cards */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Your Cards</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to offer — {selectedMyCards.size} selected</div>
                  </div>
                  <div style={{ padding: '0.75rem', overflowY: 'auto', maxHeight: 380, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignContent: 'flex-start' }}>
                    {myCards.length === 0
                      ? <div style={{ color: 'var(--text-muted)', padding: '1rem', width: '100%', textAlign: 'center' }}>No available cards</div>
                      : myCards.map(card => (
                        <SelectableCard
                          key={card.user_card_id}
                          card={card}
                          selected={selectedMyCards.has(card.user_card_id)}
                          color="var(--accent-gold)"
                          onClick={() => toggleMyCard(card)}
                        />
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* Trade summary bar */}
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}>
                {/* You receive */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    You receive ({selectedTheirCards.size} card{selectedTheirCards.size !== 1 ? 's' : ''}{theirCoinsNum > 0 ? ` + ${theirCoinsNum.toLocaleString()} coins` : ''})
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', minHeight: 28 }}>
                    {selectedTheirList.map(c => (
                      <div key={c.user_card_id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        {c.player_name}
                        <button onClick={() => toggleTheirCard(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', lineHeight: 1 }}><X size={11} /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Coins size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                      <input
                        type="number" min={0} placeholder="0"
                        value={theirCoins}
                        onChange={e => setTheirCoins(e.target.value)}
                        style={{ width: 72, padding: '0.2rem 0.4rem', background: 'var(--bg-secondary)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>
                </div>

                <ArrowLeftRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

                {/* You give */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    You give ({selectedMyCards.size} card{selectedMyCards.size !== 1 ? 's' : ''}{myCoinsNum > 0 ? ` + ${myCoinsNum.toLocaleString()} coins` : ''})
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', minHeight: 28 }}>
                    {selectedMyList.map(c => (
                      <div key={c.user_card_id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                        {c.player_name}
                        <button onClick={() => toggleMyCard(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', lineHeight: 1 }}><X size={11} /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Coins size={13} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                      <input
                        type="number" min={0} placeholder="0"
                        value={myCoins}
                        onChange={e => setMyCoins(e.target.value)}
                        style={{ width: 72, padding: '0.2rem 0.4rem', background: 'var(--bg-secondary)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSendTrade}
                  disabled={!canSend || submitting}
                  style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <ArrowLeftRight size={16} />
                  {submitting ? 'Sending...' : 'Send Offer'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TRADE LIST VIEW ── */}
      {view === 'list' && (
        tradesLoading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : trades.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ArrowLeftRight size={64} /></div>
            <div className="empty-state-title">No Pending Trades</div>
            <div className="empty-state-text">Start a new trade to swap cards with other players.</div>
          </div>
        ) : (
          <>
            {incoming.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Incoming ({incoming.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {incoming.map(trade => (
                    <TradeItem key={trade.id} trade={trade} type="incoming" onAccept={() => handleAccept(trade.id)} onDecline={() => handleDecline(trade.id)} />
                  ))}
                </div>
              </div>
            )}
            {outgoing.length > 0 && (
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Outgoing ({outgoing.length})</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {outgoing.map(trade => (
                    <TradeItem key={trade.id} trade={trade} type="outgoing" onCancel={() => handleCancel(trade.id)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

function TradeItem({ trade, type, onAccept, onDecline, onCancel }: {
  trade: Trade; type: 'incoming' | 'outgoing';
  onAccept?: () => void; onDecline?: () => void; onCancel?: () => void;
}) {
  const otherName = type === 'incoming' ? trade.sender_name : trade.receiver_name;
  const otherAvatar = type === 'incoming' ? trade.sender_avatar : trade.receiver_avatar;
  const myCards = type === 'incoming' ? trade.receiver_cards : trade.sender_cards;
  const theirCards = type === 'incoming' ? trade.sender_cards : trade.receiver_cards;
  const myCoins = type === 'incoming' ? trade.receiver_coins : trade.sender_coins;
  const theirCoins = type === 'incoming' ? trade.sender_coins : trade.receiver_coins;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {otherAvatar
            ? <img src={otherAvatar} alt={otherName} style={{ width: 28, height: 28, borderRadius: '50%' }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{otherName.charAt(0).toUpperCase()}</div>
          }
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{otherName}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {type === 'incoming' ? 'wants to trade' : '— awaiting response'}
          </span>
          {trade.expires_at && (
            <span style={{ fontSize: '0.7rem', color: new Date(trade.expires_at) < new Date(Date.now() + 86400000) ? 'var(--accent-red, #f87171)' : 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.4rem' }}>
              Expires {new Date(trade.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            You give
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {myCards.map((card, i) => <TradingCard key={`${card.id}-${i}`} card={card} size="small" />)}
            {myCoins > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.6rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                <Coins size={14} /> {myCoins.toLocaleString()}
              </div>
            )}
          </div>
        </div>
        <ArrowLeftRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, alignSelf: 'center' }} />
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            You receive
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {theirCards.map((card, i) => <TradingCard key={`${card.id}-${i}`} card={card} size="small" />)}
            {theirCoins > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.6rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                <Coins size={14} /> {theirCoins.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
