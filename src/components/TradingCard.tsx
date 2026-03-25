'use client';

interface TradingCardProps {
  card: {
    id: string;
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
  };
  onClick?: () => void;
  showPrice?: number;
  size?: 'normal' | 'small';
}

export default function TradingCard({ card, onClick, showPrice, size = 'normal' }: TradingCardProps) {
  const sizeClass = size === 'small' ? 'trading-card-sm' : '';
  
  return (
    <div
      className={`trading-card rarity-${card.rarity} ${sizeClass}`}
      onClick={onClick}
      style={size === 'small' ? { width: 160 } : undefined}
    >
      <div className="trading-card-inner">
        <div className="card-overall">{card.overall_rating}</div>
        <span className="card-rarity-badge">
          {card.rarity.toUpperCase()}
        </span>

        <div className="card-avatar-section">
          {card.player_avatar_url ? (
            <img
              src={card.player_avatar_url}
              alt={card.player_name}
              className="card-avatar"
            />
          ) : (
            <div className="card-avatar-placeholder">
              {card.player_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="card-info">
          <div className="card-player-name">{card.player_name}</div>
          <div className="card-team-info">
            <span className="card-team-name">
              {card.franchise_name || 'Free Agent'}
            </span>
            <span className="card-tier">{card.tier_abbr || '—'}</span>
          </div>

          <div className="card-stats">
            <div className="card-stat">
              <span className="card-stat-label">GPG</span>
              <span className="card-stat-value">{card.stat_gpg.toFixed(2)}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat-label">APG</span>
              <span className="card-stat-value">{card.stat_apg.toFixed(2)}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat-label">SVG</span>
              <span className="card-stat-value">{card.stat_svpg.toFixed(2)}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat-label">WIN%</span>
              <span className="card-stat-value">{(card.stat_win_pct * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="card-footer">
          <span className="card-salary">💰 {card.salary.toLocaleString()}</span>
          <span className="card-season">S{card.season_number}</span>
        </div>

        {showPrice !== undefined && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(240, 192, 64, 0.15)',
            padding: '0.4rem',
            textAlign: 'center',
            fontWeight: 800,
            color: '#f0c040',
            fontSize: '0.8rem',
            fontFamily: 'Orbitron, sans-serif',
            borderTop: '1px solid rgba(240, 192, 64, 0.3)',
          }}>
            🪙 {showPrice.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
