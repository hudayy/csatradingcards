'use client';

import { useState, useEffect } from 'react';
import { Ban, Coins } from 'lucide-react';

interface UserInfo {
  id: number;
  csa_id: number | null;
  csa_name: string | null;
  discord_username: string;
  coins: number;
}

export default function AdminPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [coinAmount, setCoinAmount] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user?.csa_id === 121) {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const addCoins = async () => {
    const amount = parseInt(coinAmount);
    if (!amount || isNaN(amount)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_coins', amount }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Added ${amount.toLocaleString()} coins. New balance: ${data.new_balance.toLocaleString()}`, ok: true });
        setUser(prev => prev ? { ...prev, coins: data.new_balance } : prev);
        setCoinAmount('');
      } else {
        setMessage({ text: data.error || 'Failed', ok: false });
      }
    } catch {
      setMessage({ text: 'Network error', ok: false });
    }
    setBusy(false);
  };

  if (loading) {
    return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;
  }

  if (!user) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><Ban size={64} /></div>
          <div className="empty-state-title">Access Denied</div>
          <div className="empty-state-text">This page is only accessible to the administrator.</div>
          <a href="/" className="btn btn-secondary">← Go Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title" style={{ color: 'var(--accent-green)' }}>Admin Panel</h1>
        <p className="page-subtitle">Dev tools — CSA ID {user.csa_id} · {user.csa_name || user.discord_username}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem', minWidth: 160,
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Balance</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Coins size={24} /> {user.coins.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Add Coins */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: '1.5rem', maxWidth: 420,
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', fontFamily: 'Orbitron, sans-serif' }}>
          Add Coins to Your Account
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="number"
            value={coinAmount}
            onChange={e => setCoinAmount(e.target.value)}
            placeholder="Amount"
            min={1}
            max={10000000}
            onKeyDown={e => e.key === 'Enter' && addCoins()}
            style={{
              flex: 1, padding: '0.6rem 0.9rem',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={addCoins}
            disabled={busy || !coinAmount}
          >
            {busy ? '...' : 'Add'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {[1000, 5000, 10000, 50000, 100000].map(n => (
            <button
              key={n}
              className="btn btn-sm btn-secondary"
              onClick={() => setCoinAmount(String(n))}
            >
              +{n.toLocaleString()}
            </button>
          ))}
        </div>

        {message && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)', fontSize: '0.875rem',
            background: message.ok ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 82, 82, 0.1)',
            border: `1px solid ${message.ok ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 82, 82, 0.3)'}`,
            color: message.ok ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {message.text}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/packs" className="btn btn-secondary">← Back to Packs</a>
      </div>
    </div>
  );
}
