import { v5 as uuidv5 } from 'uuid';
import { getLeaguePlayers, getPlayerCoreAvgs, getMemberById, getFranchises, getCurrentSeason, type CSALeaguePlayer, type CSAPlayerCoreAvgs } from './csa-api';
import { insertCard, type Card } from './db';

const CARD_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export type Rarity = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'holographic' | 'prismatic';

export const RARITY_ORDER: Rarity[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'];

export const RARITY_DROP_RATES: Record<Rarity, number> = {
  bronze: 0.40,
  silver: 0.25,
  gold: 0.18,
  platinum: 0.10,
  diamond: 0.05,
  holographic: 0.015,
  prismatic: 0.005,
};

export const RARITY_COLORS: Record<Rarity, { primary: string; secondary: string; glow: string }> = {
  bronze: { primary: '#cd7f32', secondary: '#8B5E2B', glow: 'rgba(205, 127, 50, 0.3)' },
  silver: { primary: '#c0c0c0', secondary: '#808080', glow: 'rgba(192, 192, 192, 0.3)' },
  gold: { primary: '#ffd700', secondary: '#daa520', glow: 'rgba(255, 215, 0, 0.3)' },
  platinum: { primary: '#e5e4e2', secondary: '#b8b8b8', glow: 'rgba(229, 228, 226, 0.4)' },
  diamond: { primary: '#b9f2ff', secondary: '#50c8ff', glow: 'rgba(185, 242, 255, 0.4)' },
  holographic: { primary: '#ff69b4', secondary: '#9b59b6', glow: 'rgba(255, 105, 180, 0.4)' },
  prismatic: { primary: '#ff0080', secondary: '#7c3aed', glow: 'rgba(124, 58, 237, 0.5)' },
};

export const RARITY_STAT_MULTIPLIER: Record<Rarity, number> = {
  bronze: 1.0,
  silver: 1.05,
  gold: 1.10,
  platinum: 1.15,
  diamond: 1.20,
  holographic: 1.25,
  prismatic: 1.30,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  holographic: 'Holographic',
  prismatic: 'Prismatic',
};

export function rollRarity(): Rarity {
  const roll = Math.random();
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += RARITY_DROP_RATES[rarity];
    if (roll < cumulative) return rarity;
  }
  return 'bronze';
}

export function generateCardId(playerCsaId: number, seasonId: number, rarity: Rarity): string {
  const seed = `${playerCsaId}-${seasonId}-${rarity}`;
  return uuidv5(seed, CARD_NAMESPACE);
}

function calculateOverallRating(stats: { gpg: number; apg: number; svpg: number; win_pct: number }, rarity: Rarity, salary: number): number {
  // Base rating from stats (weighted formula)
  const gpgScore = Math.min(stats.gpg * 30, 30);
  const apgScore = Math.min(stats.apg * 25, 20);
  const svpgScore = Math.min(stats.svpg * 15, 20);
  const winScore = stats.win_pct * 30;
  
  let base = gpgScore + apgScore + svpgScore + winScore;
  
  // Salary bonus (higher salary = higher floor)
  const salaryBonus = Math.min(salary / 1000, 10);
  base += salaryBonus;
  
  // Rarity multiplier
  base *= RARITY_STAT_MULTIPLIER[rarity];
  
  // Clamp
  return Math.round(Math.min(Math.max(base, 30), 99));
}

export interface PlayerPool {
  player: CSALeaguePlayer;
  stats: CSAPlayerCoreAvgs | null;
  member: { avatar_url: string | null; discord_id: string } | null;
}

let cachedPlayerPool: PlayerPool[] | null = null;
let poolCacheExpiry = 0;

export async function getPlayerPool(): Promise<PlayerPool[]> {
  if (cachedPlayerPool && Date.now() < poolCacheExpiry) {
    return cachedPlayerPool;
  }

  const season = await getCurrentSeason();
  if (!season) throw new Error('No current season found');

  const [players, allAvgs] = await Promise.all([
    getLeaguePlayers({ seasonId: season.id, active: true }),
    getPlayerCoreAvgs({ seasonId: season.id, matchType: 'REG' }),
  ]);

  const avgsByPlayer = new Map<number, CSAPlayerCoreAvgs>();
  for (const avg of allAvgs) {
    const csaId = avg.LeaguePlayer.Member.csa_id;
    const existing = avgsByPlayer.get(csaId);
    if (!existing || avg.games_played > existing.games_played) {
      avgsByPlayer.set(csaId, avg);
    }
  }

  const pool: PlayerPool[] = [];
  for (const player of players) {
    if (player.status !== 'ROS' && player.status !== 'IR') continue;
    
    const stats = avgsByPlayer.get(player.Player.csa_id) || null;
    
    pool.push({
      player,
      stats,
      member: { avatar_url: null, discord_id: player.Player.discord_id },
    });
  }

  cachedPlayerPool = pool;
  poolCacheExpiry = Date.now() + 10 * 60 * 1000;
  
  return pool;
}

export async function generateCard(poolEntry: PlayerPool, rarity: Rarity): Promise<Omit<Card, 'created_at'>> {
  const { player, stats } = poolEntry;
  
  const season = await getCurrentSeason();
  const seasonId = season?.id || 1;
  const seasonNumber = season?.number || 1;
  
  const gpg = stats ? stats.gpg : (player.active_salary / 5000) * 0.5;
  const apg = stats ? stats.apg : (player.active_salary / 5000) * 0.4;
  const svpg = stats ? stats.svpg : (player.active_salary / 5000) * 0.8;
  const winPct = stats ? stats.win_pct : 0.5;
  
  const mult = RARITY_STAT_MULTIPLIER[rarity];
  
  const cardStats = {
    gpg: Math.round(gpg * mult * 1000) / 1000,
    apg: Math.round(apg * mult * 1000) / 1000,
    svpg: Math.round(svpg * mult * 1000) / 1000,
    win_pct: Math.round(Math.min(winPct * mult, 1) * 1000) / 1000,
  };

  const cardId = generateCardId(player.Player.csa_id, seasonId, rarity);
  const overall = calculateOverallRating(cardStats, rarity, player.active_salary);
  
  // Try to get avatar
  let avatarUrl = poolEntry.member?.avatar_url || null;
  if (!avatarUrl) {
    try {
      const member = await getMemberById(player.Player.csa_id);
      if (member?.avatar_url) avatarUrl = member.avatar_url;
    } catch { /* ignore */ }
  }

  const card: Omit<Card, 'created_at'> = {
    id: cardId,
    player_csa_id: player.Player.csa_id,
    player_name: player.Player.csa_name,
    player_discord_id: player.Player.discord_id,
    player_avatar_url: avatarUrl,
    season_id: seasonId,
    season_number: seasonNumber,
    franchise_id: player.Franchise?.id || null,
    franchise_name: player.Franchise?.name || null,
    franchise_abbr: player.Franchise?.abbr || null,
    franchise_color: null,
    tier_name: player.tier || null,
    tier_abbr: player.tier || null,
    rarity,
    stat_gpg: cardStats.gpg,
    stat_apg: cardStats.apg,
    stat_svpg: cardStats.svpg,
    stat_win_pct: cardStats.win_pct,
    salary: player.active_salary,
    overall_rating: overall,
  };

  // Insert into DB (idempotent)
  insertCard(card);
  
  return card;
}

export async function generatePackCards(count: number = 5): Promise<Omit<Card, 'created_at'>[]> {
  const pool = await getPlayerPool();
  if (pool.length === 0) throw new Error('No players available for card generation');

  const cards: Omit<Card, 'created_at'>[] = [];
  const usedPlayers = new Set<number>();

  for (let i = 0; i < count; i++) {
    const rarity = rollRarity();
    
    // Pick a random player (avoid duplicates in same pack)
    let attempts = 0;
    let entry: PlayerPool;
    do {
      entry = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (usedPlayers.has(entry.player.Player.csa_id) && attempts < 50);
    
    usedPlayers.add(entry.player.Player.csa_id);
    
    const card = await generateCard(entry, rarity);
    cards.push(card);
  }

  // Sort by rarity (best last for reveal)
  cards.sort((a, b) => RARITY_ORDER.indexOf(a.rarity as Rarity) - RARITY_ORDER.indexOf(b.rarity as Rarity));

  return cards;
}
