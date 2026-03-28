'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Coins, Package, ShoppingBag, Zap, Crown, Gem, LogIn, RefreshCw, Clock, Shield } from 'lucide-react';
import { PACK_CONFIGS, type PackType } from '@/lib/pack-config';

const RARITY_COLORS: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
  platinum: '#e5e4e2', diamond: '#67e8f9', holographic: '#f472b6', prismatic: '#c084fc',
};

const PACK_ICONS: Record<Exclude<PackType, 'franchise_loyalty'>, React.ElementType> = {
  standard: Zap, elite: Crown, apex: Gem,
};

const PACK_BADGES: Record<PackType, { label: string; color: string } | null> = {
  standard: null,
  elite: { label: 'POPULAR', color: 'rgba(251,191,36,0.9)' },
  apex: { label: 'PREMIUM', color: 'rgba(139,92,246,0.9)' },
  franchise_loyalty: { label: 'ROTATING', color: 'rgba(52,211,153,0.9)' },
};

function PackVisual({ packType, pulse = false }: { packType: Exclude<PackType, 'franchise_loyalty'>; pulse?: boolean }) {
  const Icon = PACK_ICONS[packType];
  const config = PACK_CONFIGS[packType];
  return (
    <div className={`pv pv-${packType}${pulse ? ' pv-pulse' : ''}`}>
      <div className="pv-seal" />
      <div className="pv-main">
        <div className="pv-emblem-glow" />
        <Icon size={58} className="pv-icon" strokeWidth={1.5} />
        <div className="pv-brand">CSA</div>
        <div className="pv-five">5 CARDS</div>
      </div>
      <div className="pv-foot">
        <span className="pv-foot-name">{config.name.replace(' Pack', '').toUpperCase()}</span>
        <span className="pv-foot-sub">{config.subtitle}</span>
      </div>
    </div>
  );
}

interface LoyaltyRotation {
  franchise_id: number;
  franchise_name: string;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_abbr: string | null;
  period_ends_at: string;
}

function useCountdown(endsAt: string) {
  const calc = useCallback(() => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, total: 0 };
    const s = Math.floor(diff / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, total: diff };
  }, [endsAt]);
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

function LoyaltyPackVisual({ rotation, pulse = false }: { rotation: LoyaltyRotation; pulse?: boolean }) {
  const color = rotation.franchise_color ?? '#22c55e';
  const dark1 = `color-mix(in srgb, ${color} 20%, #050f0a)`;
  const dark2 = `color-mix(in srgb, ${color} 8%, #020609)`;
  return (
    <div
      className={`pv pv-loyalty${pulse ? ' pv-pulse' : ''}`}
      style={{ '--fl-color': color, '--fl-dark1': dark1, '--fl-dark2': dark2 } as React.CSSProperties}
    >
      <div className="pv-seal pv-loyalty-seal" />
      <div className="pv-main">
        <div className="pv-loyalty-glow" />
        <div className="pv-loyalty-ring" />
        {rotation.franchise_logo_url ? (
          <img src={rotation.franchise_logo_url} alt={rotation.franchise_name} className="pv-loyalty-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="pv-loyalty-abbr">{rotation.franchise_abbr ?? rotation.franchise_name.charAt(0)}</div>
        )}
        <div className="pv-five pv-loyalty-five">5 CARDS</div>
      </div>
      <div className="pv-foot">
        <span className="pv-foot-name pv-loyalty-name">{rotation.franchise_name.toUpperCase()}</span>
        <span className="pv-foot-sub">Loyalty Pack</span>
      </div>
    </div>
  );
}

function LoyaltyCountdown({ endsAt, color }: { endsAt: string; color: string }) {
  const { d, h, m, s, total } = useCountdown(endsAt);
  if (total <= 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Rotating soon...</span>;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="loyalty-countdown" style={{ '--fl-color': color } as React.CSSProperties}>
      <Clock size={12} />
      <span>Rotates in</span>
      {d > 0 && <><span className="lcd-val">{d}</span><span className="lcd-unit">d</span></>}
      <span className="lcd-val">{pad(h)}</span><span className="lcd-unit">h</span>
      <span className="lcd-val">{pad(m)}</span><span className="lcd-unit">m</span>
      <span className="lcd-val">{pad(s)}</span><span className="lcd-unit">s</span>
    </div>
  );
}

export default function ShopPage() {
  const [coins, setCoins] = useState<number | null>(null);
  const [packsRemaining, setPacksRemaining] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<PackType | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ packType: PackType; qty: number; cost: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [shopSlots, setShopSlots] = useState<{ id: number; slot_key: string; item_type: string; pack_type: string | null; coin_amount: number | null; price: number; rotation_ends: string; stock: number | null; sold_count: number }[]>([]);
  const [shopBuying, setShopBuying] = useState<number | null>(null);
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const [loyaltyRotation, setLoyaltyRotation] = useState<LoyaltyRotation | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/packs/status').then(r => r.json()),
      fetch('/api/shop').then(r => r.json()),
      fetch('/api/franchise-loyalty').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([auth, packs, shopData, loyaltyData]) => {
      if (auth.user) {
        setIsLoggedIn(true);
        setCoins(auth.user.coins);
        if (packs.packs_remaining !== undefined) setPacksRemaining(packs.packs_remaining);
      }
      if (shopData.slots) setShopSlots(shopData.slots);
      if (loyaltyData?.franchise_id) setLoyaltyRotation(loyaltyData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleShopBuy = async (slotId: number, price: number) => {
    if (shopBuying !== null) return;
    setShopBuying(slotId);
    setShopMsg(null);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId }),
      });
      const data = await res.json();
      if (data.success) {
        let msg = `Purchased!`;
        if (data.item_type === 'pack') msg = `${data.pack_type} pack added to your inventory!`;
        if (data.item_type === 'coins') msg = `${data.coin_amount?.toLocaleString()} coins added!`;
        setShopMsg(msg);
        setCoins(data.newBalance);
        window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.newBalance } }));
        setShopSlots(prev => prev.map(s => s.id === slotId ? { ...s, sold_count: s.sold_count + 1 } : s));
      } else {
        setShopMsg(data.error || 'Purchase failed');
      }
    } catch {
      setShopMsg('Network error');
    }
    setShopBuying(null);
  };

  const handleBuy = (packType: PackType) => {
    if (purchasing) return;
    const qty = quantities[packType] || 1;
    const cost = PACK_CONFIGS[packType].cost * qty;
    if (coins === null || coins < cost) return;
    setConfirmModal({ packType, qty, cost });
  };

  const executeBuy = async () => {
    if (!confirmModal || purchasing) return;
    const { packType, qty } = confirmModal;
    setConfirmModal(null);
    setPurchasing(packType);
    setError(null);
    setBuyMsg(null);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buy_pack', pack_type: packType, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Purchase failed'); setPurchasing(null); return; }
      setCoins(data.newBalance);
      window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { balance: data.newBalance } }));
      setBuyMsg(`${qty} ${PACK_CONFIGS[packType].name}${qty > 1 ? 's' : ''} added to your inventory!`);
    } catch { setError('Network error. Please try again.'); }
    setPurchasing(null);
  };

  if (loading) return (
    <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>
  );

  if (!isLoggedIn) return (
    <div className="container">
      <div className="empty-state">
        <div className="empty-state-icon"><ShoppingBag size={64} /></div>
        <div className="empty-state-title">Login Required</div>
        <div className="empty-state-text">Sign in with Discord to visit the shop.</div>
        <a href="/api/auth/discord?redirect=/shop" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogIn size={18} /> Login with Discord
        </a>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Card Shop</h1>
        <p className="page-subtitle">Spend coins to add premium packs to your inventory</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        {coins !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: '999px', padding: '6px 16px', fontWeight: 700, color: 'var(--accent-gold)' }}>
            <Coins size={16} /> {coins.toLocaleString()} coins
          </div>
        )}
        {packsRemaining !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: '6px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Package size={14} /> {packsRemaining} free pack{packsRemaining !== 1 ? 's' : ''} remaining today
            {packsRemaining > 0 && <> · <Link href="/packs" style={{ color: 'var(--accent-gold)', textDecoration: 'none' }}>Open free</Link></>}
          </div>
        )}
      </div>

      {error && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="shop-grid">
        {(Object.keys(PACK_CONFIGS) as PackType[]).filter(pt => pt !== 'franchise_loyalty').map(packType => {
          const config = PACK_CONFIGS[packType];
          const badge = PACK_BADGES[packType];
          const qty = quantities[packType] || 1;
          const canAfford = coins !== null && coins >= config.cost * qty;
          const isBuying = purchasing === packType;

          return (
            <div key={packType} className={`shop-card shop-card-${packType}`}>
              {badge && (
                <div className="shop-badge" style={{ background: badge.color, color: '#000' }}>{badge.label}</div>
              )}

              <PackVisual packType={packType as Exclude<PackType, 'franchise_loyalty'>} pulse={isBuying} />

              <div className="shop-card-info">
                <h3 className="shop-pack-name">{config.name}</h3>
                <p className="shop-pack-flavour">{config.flavour}</p>

                <div className="shop-rarity-row">
                  {config.allowedRarities.map(r => (
                    <div
                      key={r}
                      className="rarity-pip"
                      style={{ background: RARITY_COLORS[r], boxShadow: `0 0 6px ${RARITY_COLORS[r]}88` }}
                      title={r.charAt(0).toUpperCase() + r.slice(1)}
                    />
                  ))}
                </div>

                <div className="shop-price-row">
                  <Coins size={20} />
                  <span>{(config.cost * qty).toLocaleString()}</span>
                  {qty > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({config.cost.toLocaleString()} each)</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.25rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => setQuantities(q => ({ ...q, [packType]: Math.max(1, (q[packType] || 1) - 1) }))}
                    disabled={!!purchasing}
                  >−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '1rem', lineHeight: 1 }}
                    onClick={() => setQuantities(q => ({ ...q, [packType]: Math.min(10, (q[packType] || 1) + 1) }))}
                    disabled={!!purchasing}
                  >+</button>
                </div>

                <button
                  className={`btn shop-buy-btn shop-buy-${packType}`}
                  onClick={() => handleBuy(packType)}
                  disabled={!!purchasing || !canAfford}
                >
                  {isBuying ? 'Buying...' : !canAfford ? `Need ${((config.cost * qty) - (coins ?? 0)).toLocaleString()} more` : 'Buy & Add to Inventory'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {buyMsg && (
        <div style={{ textAlign: 'center', marginTop: '1rem', padding: '0.75rem', background: 'rgba(72,199,116,0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {buyMsg} <a href="/collection" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>→ View Inventory</a>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Earn coins by selling cards on the marketplace, completing trades, and collecting your daily login bonus.
      </div>

      {/* ── Franchise Loyalty Pack ── */}
      {loyaltyRotation && (() => {
        const config = PACK_CONFIGS.franchise_loyalty;
        const color = loyaltyRotation.franchise_color ?? '#22c55e';
        const canAfford = coins !== null && coins >= config.cost;
        const isBuying = purchasing === 'franchise_loyalty';
        return (
          <div className="loyalty-section" style={{ '--fl-color': color } as React.CSSProperties}>
            <div className="loyalty-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Shield size={18} style={{ color }} />
                <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>Franchise Loyalty Pack</span>
                <span className="loyalty-rotating-badge">ROTATING</span>
              </div>
              <LoyaltyCountdown endsAt={loyaltyRotation.period_ends_at} color={color} />
            </div>

            <div className="loyalty-card">
              <div className="loyalty-card-glow" style={{ background: `radial-gradient(ellipse at 30% 50%, ${color}40 0%, transparent 65%)` }} />
              <div className="loyalty-pack-side">
                <LoyaltyPackVisual rotation={loyaltyRotation} pulse={isBuying} />
              </div>
              <div className="loyalty-info-side">
                <div className="loyalty-franchise-row">
                  {loyaltyRotation.franchise_logo_url && (
                    <img src={loyaltyRotation.franchise_logo_url} alt="" className="loyalty-franchise-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <div>
                    <div className="loyalty-franchise-name" style={{ color }}>{loyaltyRotation.franchise_name}</div>
                    <div className="loyalty-franchise-sub">Featured Franchise</div>
                  </div>
                </div>
                <p className="loyalty-flavour">{config.flavour}</p>
                <div className="shop-rarity-row" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
                  {config.allowedRarities.map(r => (
                    <div key={r} className="rarity-pip" style={{ background: RARITY_COLORS[r], boxShadow: `0 0 6px ${RARITY_COLORS[r]}88` }} title={r.charAt(0).toUpperCase() + r.slice(1)} />
                  ))}
                </div>
                <div className="shop-price-row" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
                  <Coins size={20} />
                  <span>{config.cost.toLocaleString()}</span>
                </div>
                <button
                  className="btn loyalty-buy-btn"
                  style={{ '--fl-color': color } as React.CSSProperties}
                  onClick={() => handleBuy('franchise_loyalty')}
                  disabled={!!purchasing || !canAfford}
                >
                  {isBuying ? 'Buying...' : !canAfford ? `Need ${(config.cost - (coins ?? 0)).toLocaleString()} more` : 'Buy & Add to Inventory'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Rotating Deals ── */}
      {shopSlots.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} style={{ color: '#818cf8' }} /> Rotating Deals
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Limited-time offers that refresh daily and weekly.</p>
          {shopMsg && <div style={{ padding: '0.65rem', background: 'rgba(72,199,116,0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', color: 'var(--accent-green)', marginBottom: '1rem', fontSize: '0.85rem' }}>{shopMsg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {shopSlots.map(slot => {
              const isSoldOut = slot.stock !== null && slot.sold_count >= slot.stock;
              const canAfford = coins !== null && coins >= slot.price;
              const endsAt = new Date(slot.rotation_ends);
              const isDaily = slot.slot_key.startsWith('daily');
              return (
                <div key={slot.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  opacity: isSoldOut ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '0.15rem 0.5rem', borderRadius: 4,
                      background: isDaily ? 'rgba(249,115,22,0.2)' : 'rgba(129,140,248,0.2)',
                      color: isDaily ? '#f97316' : '#818cf8',
                    }}>{isDaily ? 'Daily' : 'Weekly'}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} /> {endsAt.toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {slot.item_type === 'pack' ? `${slot.pack_type?.charAt(0).toUpperCase()}${slot.pack_type?.slice(1)} Pack` : `${slot.coin_amount?.toLocaleString()} Coins`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {slot.item_type === 'pack' ? '5 cards' : 'Bonus coins'}
                    {slot.stock !== null && ` · ${slot.stock - slot.sold_count} left`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: 'var(--accent-gold)', fontSize: '0.9rem' }}>
                    <Coins size={14} /> {slot.price.toLocaleString()}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', marginTop: '0.25rem' }}
                    disabled={isSoldOut || !canAfford || shopBuying !== null}
                    onClick={() => handleShopBuy(slot.id, slot.price)}
                  >
                    {isSoldOut ? 'Sold Out' : !canAfford ? 'Not Enough Coins' : shopBuying === slot.id ? 'Buying...' : 'Buy'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {confirmModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.5rem', marginBottom: '1rem' }}>Confirm Purchase</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '1.05rem' }}>
              Buy <strong>{confirmModal.qty}</strong> {confirmModal.packType === 'franchise_loyalty' && loyaltyRotation ? `${loyaltyRotation.franchise_name} Loyalty Pack` : PACK_CONFIGS[confirmModal.packType].name}{confirmModal.qty > 1 ? 's' : ''} for <strong style={{ color: 'var(--accent-gold)' }}>{confirmModal.cost.toLocaleString()} coins</strong>?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)} disabled={!!purchasing} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={executeBuy} disabled={!!purchasing} style={{ flex: 1 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
