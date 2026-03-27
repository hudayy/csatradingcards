'use client';

import { useState, useEffect, useRef } from 'react';
import { Ban, Coins, Users, BarChart3, ShoppingBag, ArrowLeftRight, Search, Shield, ShieldOff, Trash2, RefreshCw, Star } from 'lucide-react';
import TradingCard from '@/components/TradingCard';

interface UserInfo { id: number; csa_id: number | null; csa_name: string | null; discord_username: string; coins: number; is_admin: boolean; is_super_admin: boolean; }
interface AdminUser { id: number; csa_id: number | null; csa_name: string | null; discord_username: string; avatar_url: string | null; coins: number; is_admin: number; card_count: number; last_login: string; }
interface Stats { totalUsers: number; totalCards: number; totalListings: number; totalListingValue: number; totalTrades: number; totalCoins: number; cardsByRarity: { rarity: string; count: number }[]; admins: { id: number; discord_username: string; csa_id: number | null; csa_name: string | null; avatar_url: string | null }[]; }
interface Listing { id: number; player_name: string; rarity: string; franchise_name: string | null; price: number; seller_name: string; seller_csa_name: string | null; listed_at: string; }
interface Trade { id: number; sender_name: string; sender_csa_name: string | null; receiver_name: string; receiver_csa_name: string | null; sender_coins: number; receiver_coins: number; created_at: string; }
interface CardData { id: string; user_card_id: number; player_name: string; rarity: string; franchise_name: string | null; season_number: number; is_listed: number; }
interface FeaturedConfig { position: number; csa_id: number; rarity: string; }
interface FeaturedCardData { id: string; card_type?: 'player' | 'gm'; player_name: string; player_avatar_url: string | null; franchise_name: string | null; franchise_abbr: string | null; franchise_logo_url?: string | null; franchise_color?: string | null; franchise_conf?: string | null; tier_name: string | null; tier_abbr: string | null; rarity: string; stat_gpg: number; stat_apg: number; stat_svpg: number; stat_win_pct: number; salary: number; overall_rating: number; season_number: number; }

const RARITIES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

type Tab = 'dashboard' | 'users' | 'marketplace' | 'trades';

function Msg({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: msg.ok ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)', border: `1px solid ${msg.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`, color: msg.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
      {msg.text}
    </div>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userCards, setUserCards] = useState<CardData[]>([]);
  const [coinAmount, setCoinAmount] = useState('');
  const [selfCoinAmount, setSelfCoinAmount] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [featuredConfig, setFeaturedConfig] = useState<FeaturedConfig[]>([
    { position: 1, csa_id: 420, rarity: 'gold' },
    { position: 2, csa_id: 121, rarity: 'prismatic' },
    { position: 3, csa_id: 314, rarity: 'bronze' },
  ]);
  const [featuredPreview, setFeaturedPreview] = useState<FeaturedCardData[]>([]);
  const [featuredPreviewLoading, setFeaturedPreviewLoading] = useState(false);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.is_admin || d.user?.is_super_admin) setMe(d.user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!me) return;
    if (tab === 'dashboard') { loadStats(); loadFeaturedConfig(); loadFeaturedPreview(); }
    if (tab === 'users') loadUsers('');
    if (tab === 'marketplace') loadListings();
    if (tab === 'trades') loadTrades();
  }, [tab, me]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadUsers(userSearch), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [userSearch]);

  const api = async (body: object) => {
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const loadStats = async () => {
    const d = await fetch('/api/admin?action=stats').then(r => r.json());
    setStats(d);
  };

  const loadFeaturedConfig = async () => {
    const d = await fetch('/api/admin?action=featured').then(r => r.json());
    if (d.featured) setFeaturedConfig(d.featured);
  };

  const loadFeaturedPreview = async () => {
    setFeaturedPreviewLoading(true);
    const d = await fetch('/api/featured').then(r => r.json()).catch(() => ({}));
    setFeaturedPreview(d.cards || []);
    setFeaturedPreviewLoading(false);
  };

  const handleSaveFeaturedSlot = async (slot: FeaturedConfig) => {
    setSavingSlot(slot.position);
    const d = await api({ action: 'set_featured', position: slot.position, csa_id: slot.csa_id, rarity: slot.rarity });
    setSavingSlot(null);
    if (d.success) { flash(`Slot ${slot.position} updated`, true); loadFeaturedPreview(); }
    else flash(d.error || 'Failed', false);
  };
  const loadUsers = async (q: string) => {
    const d = await fetch(`/api/admin?action=users&q=${encodeURIComponent(q)}`).then(r => r.json());
    setUsers(d.users || []);
  };
  const loadListings = async () => {
    const d = await fetch('/api/admin?action=listings').then(r => r.json());
    setListings(d.listings || []);
  };
  const loadTrades = async () => {
    const d = await fetch('/api/admin?action=trades').then(r => r.json());
    setTrades(d.trades || []);
  };
  const loadUserCards = async (userId: number) => {
    const d = await fetch(`/api/admin?action=user_cards&user_id=${userId}`).then(r => r.json());
    setUserCards(d.cards || []);
  };

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAddCoinsSelf = async () => {
    const amt = parseInt(selfCoinAmount);
    if (!amt) return;
    const d = await api({ action: 'add_coins_self', amount: amt });
    if (d.success) { flash(`Added ${amt.toLocaleString()} coins. Balance: ${d.new_balance.toLocaleString()}`, true); setMe(prev => prev ? { ...prev, coins: d.new_balance } : prev); setSelfCoinAmount(''); }
    else flash(d.error || 'Failed', false);
  };

  const handleAddCoinsUser = async () => {
    if (!selectedUser) return;
    const amt = parseInt(coinAmount);
    if (!amt || isNaN(amt)) return;
    const d = await api({ action: 'add_coins', user_id: selectedUser.id, amount: amt });
    if (d.success) { flash(`Done. New balance: ${d.new_balance.toLocaleString()}`, true); setSelectedUser(prev => prev ? { ...prev, coins: d.new_balance } : prev); setCoinAmount(''); }
    else flash(d.error || 'Failed', false);
  };

  const handleSetAdmin = async (userId: number, makeAdmin: boolean) => {
    const d = await api({ action: 'set_admin', user_id: userId, is_admin: makeAdmin });
    if (d.success) { flash(`Admin status updated`, true); loadUsers(userSearch); if (tab === 'dashboard') loadStats(); }
    else flash(d.error || 'Failed', false);
  };

  const handleCancelListing = async (listingId: number) => {
    const d = await api({ action: 'cancel_listing', listing_id: listingId });
    if (d.success) { flash('Listing cancelled', true); setListings(prev => prev.filter(l => l.id !== listingId)); }
    else flash(d.error || 'Failed', false);
  };

  const handleCancelTrade = async (tradeId: number) => {
    const d = await api({ action: 'cancel_trade', trade_id: tradeId });
    if (d.success) { flash('Trade cancelled', true); setTrades(prev => prev.filter(t => t.id !== tradeId)); }
    else flash(d.error || 'Failed', false);
  };

  const handleRemoveCard = async (userCardId: number) => {
    const d = await api({ action: 'remove_card', user_card_id: userCardId });
    if (d.success) { flash('Card removed', true); setUserCards(prev => prev.filter(c => c.user_card_id !== userCardId)); }
    else flash(d.error || 'Failed', false);
  };

  const selectUser = (u: AdminUser) => {
    setSelectedUser(u);
    setCoinAmount('');
    setUserCards([]);
    loadUserCards(u.id);
  };

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  if (!me) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><Ban size={64} /></div>
          <div className="empty-state-title">Access Denied</div>
          <div className="empty-state-text">This page is only accessible to administrators.</div>
          <a href="/" className="btn btn-secondary">← Go Home</a>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={15} /> },
    { id: 'users', label: 'Users', icon: <Users size={15} /> },
    { id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag size={15} /> },
    { id: 'trades', label: 'Trades', icon: <ArrowLeftRight size={15} /> },
  ];

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' };

  return (
    <div className="container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title" style={{ color: 'var(--accent-green)' }}>Admin Panel</h1>
          <p className="page-subtitle">{me.is_super_admin ? 'Super Admin' : 'Admin'} · {me.csa_name || me.discord_username} · <Coins size={13} style={{ verticalAlign: 'middle' }} /> {me.coins.toLocaleString()}</p>
        </div>
      </div>

      <Msg msg={msg} />

      {/* Self coin tool */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Add coins to yourself:</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[1000, 5000, 10000, 50000, 100000].map(n => (
            <button key={n} className="btn btn-sm btn-secondary" onClick={() => setSelfCoinAmount(String(n))}>+{n.toLocaleString()}</button>
          ))}
          <input type="number" value={selfCoinAmount} onChange={e => setSelfCoinAmount(e.target.value)} placeholder="Custom" onKeyDown={e => e.key === 'Enter' && handleAddCoinsSelf()} style={{ width: 90, padding: '0.3rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
          <button className="btn btn-primary btn-sm" onClick={handleAddCoinsSelf} disabled={!selfCoinAmount}>Add</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: tab === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent', marginBottom: '-1px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'var(--accent-blue)' },
              { label: 'Cards in Circulation', value: stats.totalCards.toLocaleString(), color: 'var(--accent-green)' },
              { label: 'Active Listings', value: stats.totalListings.toLocaleString(), color: 'var(--accent-gold)' },
              { label: 'Listing Value', value: stats.totalListingValue.toLocaleString(), color: 'var(--accent-gold)' },
              { label: 'Pending Trades', value: stats.totalTrades.toLocaleString(), color: 'var(--accent-blue)' },
              { label: 'Coins in Circulation', value: stats.totalCoins.toLocaleString(), color: 'var(--accent-gold)' },
            ].map(s => (
              <div key={s.label} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Cards by rarity */}
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Cards by Rarity</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {stats.cardsByRarity.map(r => (
                <div key={r.rarity} style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.rarity}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{r.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Admins list */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Admins</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Super admin */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                <Shield size={14} style={{ color: 'var(--accent-green)' }} />
                <span style={{ fontWeight: 700 }}>{me.is_super_admin ? (me.csa_name || me.discord_username) : `CSA ID ${121}`}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>Super Admin</span>
              </div>
              {stats.admins.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
                  {a.avatar_url && <img src={a.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />}
                  <span>{a.csa_name || a.discord_username}</span>
                  {a.csa_id && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>CSA #{a.csa_id}</span>}
                  {me.is_super_admin && (
                    <button className="btn btn-danger btn-sm" style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }} onClick={() => handleSetAdmin(a.id, false)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {stats.admins.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No other admins</span>}
            </div>
          </div>

          {/* Featured Cards editor */}
          <div style={{ ...cardStyle, marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Star size={14} style={{ color: 'var(--accent-gold)' }} /> Featured Cards (Home Page)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {featuredConfig.map(slot => (
                <div key={slot.position} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 48 }}>Slot {slot.position}</span>
                  <input
                    type="number"
                    placeholder="CSA ID"
                    value={slot.csa_id}
                    onChange={e => setFeaturedConfig(prev => prev.map(s => s.position === slot.position ? { ...s, csa_id: parseInt(e.target.value) || 0 } : s))}
                    style={{ width: 90, padding: '0.35rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                  <select
                    value={slot.rarity}
                    onChange={e => setFeaturedConfig(prev => prev.map(s => s.position === slot.position ? { ...s, rarity: e.target.value } : s))}
                    style={{ padding: '0.35rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', textTransform: 'capitalize' }}
                  >
                    {RARITIES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSaveFeaturedSlot(slot)}
                    disabled={savingSlot === slot.position || !slot.csa_id}
                  >
                    {savingSlot === slot.position ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {featuredPreviewLoading ? 'Loading preview…' : 'Preview (current live cards):'}
              </div>
              {!featuredPreviewLoading && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {featuredPreview.map((card, i) => (
                    <TradingCard key={i} card={card} size="small" />
                  ))}
                  {featuredPreview.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No preview available</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          {/* User list */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="text" placeholder="Search by name or CSA ID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ flex: 1, padding: '0.45rem 0.7rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.875rem' }} />
              <button className="btn btn-secondary btn-sm" onClick={() => loadUsers(userSearch)}><RefreshCw size={13} /></button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 480, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {users.map(u => (
                <div key={u.id} onClick={() => selectUser(u)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: selectedUser?.id === u.id ? 'rgba(96,165,250,0.1)' : 'transparent', border: selectedUser?.id === u.id ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.csa_name || u.discord_username}
                      {u.is_admin === 1 && <Shield size={11} style={{ color: 'var(--accent-blue)', marginLeft: 4, verticalAlign: 'middle' }} />}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {u.csa_id ? `CSA #${u.csa_id} · ` : ''}{u.card_count} cards · {u.coins.toLocaleString()} coins
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User detail panel */}
          {selectedUser && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedUser.csa_name || selectedUser.discord_username}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selectedUser.csa_id ? `CSA #${selectedUser.csa_id} · ` : ''}{selectedUser.discord_username} · ID {selectedUser.id}
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>✕</button>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cards</div>
                  <div style={{ fontWeight: 700 }}>{selectedUser.card_count}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Coins</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{selectedUser.coins.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Login</div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{new Date(selectedUser.last_login).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Add/remove coins */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Adjust coins</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  {[-10000, -1000, 1000, 5000, 10000, 50000].map(n => (
                    <button key={n} className="btn btn-sm btn-secondary" style={{ fontSize: '0.72rem' }} onClick={() => setCoinAmount(String(n))}>
                      {n > 0 ? '+' : ''}{n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" value={coinAmount} onChange={e => setCoinAmount(e.target.value)} placeholder="Amount (+/-)" onKeyDown={e => e.key === 'Enter' && handleAddCoinsUser()} style={{ flex: 1, padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                  <button className="btn btn-primary btn-sm" onClick={handleAddCoinsUser} disabled={!coinAmount}>Apply</button>
                </div>
              </div>

              {/* Admin toggle (super admin only) */}
              {me.is_super_admin && selectedUser.csa_id !== 121 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Admin access</div>
                  {selectedUser.is_admin === 1 ? (
                    <button className="btn btn-danger btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => handleSetAdmin(selectedUser.id, false)}>
                      <ShieldOff size={13} /> Remove Admin
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => handleSetAdmin(selectedUser.id, true)}>
                      <Shield size={13} /> Grant Admin
                    </button>
                  )}
                </div>
              )}

              {/* Collection */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Collection ({userCards.length})</div>
                <div style={{ overflowY: 'auto', maxHeight: 220, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {userCards.map(c => (
                    <div key={c.user_card_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', fontSize: '0.8rem' }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{c.player_name}</span>
                      <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{c.rarity} · S{c.season_number}</span>
                      {c.is_listed === 1 && <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)' }}>Listed</span>}
                      <button onClick={() => handleRemoveCard(c.user_card_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', padding: 2, display: 'flex' }} title="Remove card">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {userCards.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No cards</span>}
                </div>
              </div>

              <Msg msg={msg} />
            </div>
          )}
        </div>
      )}

      {/* Marketplace */}
      {tab === 'marketplace' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Active Listings ({listings.length})</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadListings}><RefreshCw size={13} /></button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 520, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {listings.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.player_name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {l.rarity} · {l.franchise_name || 'Free Agent'} · Seller: {l.seller_csa_name || l.seller_name}
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  <Coins size={13} /> {l.price.toLocaleString()}
                </span>
                <button className="btn btn-danger btn-sm" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => handleCancelListing(l.id)}>
                  <Trash2 size={12} /> Cancel
                </button>
              </div>
            ))}
            {listings.length === 0 && <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>No active listings</div>}
          </div>
        </div>
      )}

      {/* Trades */}
      {tab === 'trades' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Pending Trades ({trades.length})</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadTrades}><RefreshCw size={13} /></button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 520, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {trades.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t.sender_csa_name || t.sender_name} ↔ {t.receiver_csa_name || t.receiver_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {t.sender_coins > 0 && `Sender adds ${t.sender_coins.toLocaleString()} coins · `}
                    {t.receiver_coins > 0 && `Receiver adds ${t.receiver_coins.toLocaleString()} coins · `}
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => handleCancelTrade(t.id)}>
                  <Trash2 size={12} /> Cancel
                </button>
              </div>
            ))}
            {trades.length === 0 && <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>No pending trades</div>}
          </div>
        </div>
      )}
    </div>
  );
}
