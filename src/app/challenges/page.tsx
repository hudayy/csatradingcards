'use client';

import { useState, useEffect } from 'react';
import { LogIn, CheckCircle, Circle, Gift, Zap, Calendar } from 'lucide-react';

interface Challenge {
  id: number;
  type: string;
  key: string;
  title: string;
  description: string;
  reward_coins: number;
  reward_pack_type: string | null;
  target: number;
  period_key: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export default function ChallengesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setIsLoggedIn(true);
          return fetch('/api/challenges').then(r => r.json()).then(d => {
            if (d.challenges) setChallenges(d.challenges);
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (challenge: Challenge) => {
    setClaiming(challenge.id);
    setMessage(null);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challenge.id, period_key: challenge.period_key }),
      });
      const data = await res.json();
      if (data.success) {
        let msg = `Claimed ${data.coins} coins!`;
        if (data.pack) msg += ` + 1 ${data.pack} pack added to your inventory!`;
        setMessage({ type: 'success', text: msg });
        setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, claimed: true } : c));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to claim' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    }
    setClaiming(null);
  };

  if (loading) return <div className="container"><div className="loading-spinner"><div className="spinner" /></div></div>;

  if (!isLoggedIn) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon"><Zap size={64} /></div>
          <div className="empty-state-title">Login Required</div>
          <div className="empty-state-text">Sign in to view and complete challenges.</div>
          <a href="/api/auth/discord?redirect=/challenges" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} /> Login with Discord
          </a>
        </div>
      </div>
    );
  }

  const daily = challenges.filter(c => c.type === 'daily');
  const weekly = challenges.filter(c => c.type === 'weekly');
  const completedCount = challenges.filter(c => c.completed && !c.claimed).length;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Challenges</h1>
        <p className="page-subtitle">
          Complete challenges to earn coins and packs.
          {completedCount > 0 && <strong style={{ color: 'var(--accent-green)' }}> {completedCount} ready to claim!</strong>}
        </p>
      </div>

      {message && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1.25rem', borderRadius: 'var(--radius-md)',
          background: message.type === 'success' ? 'rgba(72,199,116,0.1)' : 'rgba(255,82,82,0.1)',
          color: message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
          border: `1px solid ${message.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        }}>
          {message.text}
        </div>
      )}

      {[{ label: 'Daily Challenges', icon: <Zap size={16} style={{ color: '#f97316' }} />, items: daily },
        { label: 'Weekly Challenges', icon: <Calendar size={16} style={{ color: '#818cf8' }} />, items: weekly }].map(section => (
        <div key={section.label} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Orbitron, sans-serif', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {section.icon} {section.label}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {section.items.map(c => {
              const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
              return (
                <div key={c.id} style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${c.completed && !c.claimed ? 'rgba(72,199,116,0.5)' : c.claimed ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '0.9rem 1.1rem',
                  display: 'flex', alignItems: 'center', gap: '1rem', opacity: c.claimed ? 0.6 : 1,
                }}>
                  <div style={{ flexShrink: 0 }}>
                    {c.claimed ? <CheckCircle size={22} style={{ color: 'var(--accent-green)' }} /> : c.completed ? <CheckCircle size={22} style={{ color: 'var(--accent-green)' }} /> : <Circle size={22} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.15rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{c.description}</div>
                    {!c.completed && (
                      <div style={{ height: 5, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-blue)', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    )}
                    {!c.completed && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{c.progress}/{c.target}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {c.reward_coins > 0 && `${c.reward_coins} coins`}
                      {c.reward_pack_type && ` + 1 ${c.reward_pack_type} pack`}
                    </div>
                    {c.completed && !c.claimed && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => handleClaim(c)}
                        disabled={claiming === c.id}
                      >
                        <Gift size={13} /> {claiming === c.id ? 'Claiming...' : 'Claim'}
                      </button>
                    )}
                    {c.claimed && <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 600 }}>Claimed</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
