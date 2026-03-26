'use client';

import { useRef, useState, MouseEvent } from 'react';
import { Coins } from 'lucide-react';

interface TradingCardProps {
  card: {
    id: string;
    card_type?: 'player' | 'gm';
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

function darkenHex(hex: string, factor = 0.5): string {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default function TradingCard({ card, onClick, showPrice, size = 'normal' }: TradingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const sizeClass = size === 'small' ? 'trading-card-sm' : '';

  const tierLogoUrl = card.tier_name
    ? `https://api.playcsa.com/assets/tiers/${card.tier_name.replace(/\s+/g, '_')}.png`
    : null;

  const confLogoUrl = card.franchise_conf
    ? `https://api.playcsa.com/assets/league/${card.franchise_conf.toLowerCase()}.png`
    : null;

  const bannerStyle = card.franchise_color
    ? { background: `linear-gradient(135deg, ${card.franchise_color}cc 0%, ${card.franchise_color}66 50%, rgba(0,0,0,0.85) 100%)` }
    : undefined;

  const getRarityDisplay = (r: string) => {
    switch (r) {
      case 'bronze': return 'BRONZE';
      case 'silver': return 'SILVER';
      case 'gold': return 'GOLD';
      case 'platinum': return 'PLATINUM';
      case 'diamond': return 'DIAMOND';
      case 'holographic': return 'HOLO';
      case 'prismatic': return 'PRISMATIC';
      default: return r.toUpperCase();
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;
    const tiltX = -((y / rect.height) - 0.5) * 30;
    const tiltY = ((x / rect.width) - 0.5) * 30;
    cardRef.current.style.setProperty('--mouse-x', `${px}%`);
    cardRef.current.style.setProperty('--mouse-y', `${py}%`);
    cardRef.current.style.setProperty('--tilt-x', `${tiltX}deg`);
    cardRef.current.style.setProperty('--tilt-y', `${tiltY}deg`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (cardRef.current) cardRef.current.style.transition = 'transform 0.1s ease-out';
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
      cardRef.current.style.setProperty('--tilt-x', '0deg');
      cardRef.current.style.setProperty('--tilt-y', '0deg');
      cardRef.current.style.setProperty('--mouse-x', '50%');
      cardRef.current.style.setProperty('--mouse-y', '50%');
    }
  };

  const sharedHandlers = {
    onClick,
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  // ---- GM card ----
  if (card.card_type === 'gm') {
    const color = card.franchise_color;
    const gmBg = color
      ? `linear-gradient(160deg, ${color} 0%, ${darkenHex(color, 0.55)} 100%)`
      : 'linear-gradient(160deg, #334155 0%, #0f172a 100%)';

    return (
      <div
        ref={cardRef}
        className={`trading-card gm-card ${sizeClass} ${isHovered ? 'is-hovered' : ''}`}
        style={{ background: gmBg, ...(size === 'small' ? { width: 180, height: 280 } : {}) }}
        {...sharedHandlers}
      >
        <div
          className="trading-card-glow-bg"
          style={color ? { background: `radial-gradient(ellipse at 50% 50%, ${color}bb, transparent 70%)`, opacity: 1 } : undefined}
        />

        <div className="trading-card-inner gm-card-inner">
          <div className="card-glare" />
          <div className="card-foil-sweep" />

          {/* Top bar: franchise logo left, GM chip right */}
          <div className="card-top-bar">
            <div className="card-top-bar-left">
              {card.franchise_logo_url && (
                <img
                  src={card.franchise_logo_url}
                  alt={card.franchise_name || ''}
                  className="gm-franchise-logo-top"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <div className="card-top-bar-right">
              <span className="gm-chip">GM</span>
            </div>
          </div>

          {/* Avatar */}
          <div className="card-avatar-section gm-avatar-section">
            <div className="card-concentric-rings gm-rings" />
            {card.player_avatar_url && !avatarError ? (
              <img
                src={card.player_avatar_url}
                alt={card.player_name}
                className="card-avatar"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="card-avatar-placeholder">{card.player_name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          {/* Name section */}
          <div className="gm-name-section">
            <div className="gm-player-name">{card.player_name}</div>
            <div className="gm-role-label">GENERAL MANAGER</div>
            <div className="gm-franchise-name">{card.franchise_name}</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Standard player card ----
  return (
    <div
      ref={cardRef}
      className={`trading-card rarity-${card.rarity} ${sizeClass} ${isHovered ? 'is-hovered' : ''}`}
      style={size === 'small' ? { width: 180, height: 280 } : undefined}
      {...sharedHandlers}
    >
      <div className="trading-card-glow-bg"></div>

      <div className="trading-card-inner">
        <div className="card-glare"></div>
        <div className="card-foil-sweep"></div>

        <div className="card-top-bar">
          <div className="card-top-bar-left">
            {tierLogoUrl && (
              <img
                src={tierLogoUrl}
                alt={card.tier_name || ''}
                className="card-tier-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <span className="card-tier-label">{card.tier_name ? card.tier_name.replace(/_/g, ' ').toUpperCase() : 'CONTENDER'}</span>
          </div>
          <div className="card-top-bar-right">
            {confLogoUrl && (
              <img
                src={confLogoUrl}
                alt={card.franchise_conf || ''}
                className="card-conf-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <span className="card-rarity-badge">{getRarityDisplay(card.rarity)}</span>
          </div>
        </div>

        <div className="card-avatar-section">
          <div className="card-concentric-rings"></div>
          {card.player_avatar_url && !avatarError ? (
            <img
              src={card.player_avatar_url}
              alt={card.player_name}
              className="card-avatar"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="card-avatar-placeholder">
              {card.player_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="card-name-banner" style={bannerStyle}>
          <div className="card-player-name">{card.player_name}</div>
          {card.franchise_name ? (
            <div className="card-team-name">
              {card.franchise_logo_url && (
                <img
                  src={card.franchise_logo_url}
                  alt={card.franchise_name}
                  className="card-franchise-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {card.franchise_name}
            </div>
          ) : (
            <div className="card-team-name">Free Agent</div>
          )}
        </div>

        {showPrice && (
          <div className="card-price-tag">
            <Coins size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {showPrice.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
