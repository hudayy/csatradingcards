import { v5 as uuidv5 } from 'uuid';
import { getLeaguePlayers, getMemberById, getFranchises, getFranchiseDetails, getCurrentSeason, getMembers, type CSALeaguePlayer, type CSAFranchise } from './csa-api';
import { insertCard, syncFranchiseDataOnCards, type Card } from './db';

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

import { PACK_CONFIGS } from './pack-config';
import type { PackType } from './pack-config';
export { PACK_CONFIGS };
export type { PackType };

export function rollRarityForPack(packType: PackType): Rarity {
  const allowed = PACK_CONFIGS[packType].allowedRarities as Rarity[];
  const total = allowed.reduce((sum, r) => sum + RARITY_DROP_RATES[r], 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    if (!allowed.includes(rarity)) continue;
    cumulative += RARITY_DROP_RATES[rarity];
    if (roll < cumulative) return rarity;
  }
  return allowed[0];
}

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


export interface PlayerPool {
  player: CSALeaguePlayer;
  member: { avatar_url: string | null; discord_id: string } | null;
  franchise: CSAFranchise | null;
  franchise_conf: string | null;
}

let cachedPlayerPool: PlayerPool[] | null = null;
let poolCacheExpiry = 0;

export async function getPlayerPool(): Promise<PlayerPool[]> {
  if (cachedPlayerPool && Date.now() < poolCacheExpiry) {
    return cachedPlayerPool;
  }

  const season = await getCurrentSeason();
  if (!season) throw new Error('No current season found');

  // Fetch players, members, franchises, and franchise details concurrently.
  // Non-critical calls (members, franchises) degrade gracefully on partial failure.
  const [playersResult, allMembersResult, franchisesResult, franchiseDetailsResult] = await Promise.allSettled([
    getLeaguePlayers({ seasonId: season.id, active: true }),
    import('./csa-api').then(m => m.getMembers()),
    getFranchises(),
    getFranchiseDetails(season.id),
  ]);
  if (playersResult.status === 'rejected') throw playersResult.reason;
  const players = playersResult.value;
  const allMembers = allMembersResult.status === 'fulfilled' ? allMembersResult.value : [];
  const franchises = franchisesResult.status === 'fulfilled' ? franchisesResult.value : [];
  const franchiseDetails = franchiseDetailsResult.status === 'fulfilled' ? franchiseDetailsResult.value : [];

  const franchiseMap = new Map(franchises.map(f => [f.id, f]));
  const franchiseConfMap = new Map(franchiseDetails.map(fd => [fd.Franchise.id, fd.conf]));

  // Back-fill any existing cards that have null franchise color/logo/conf
  for (const [franchiseId, franchise] of franchiseMap.entries()) {
    const logoUrl = franchise.logo
      ? (franchise.logo.startsWith('http') ? franchise.logo : `https://api.playcsa.com${franchise.logo}`)
      : null;
    const conf = franchiseConfMap.get(franchiseId) ?? null;
    syncFranchiseDataOnCards(franchiseId, franchise.color, logoUrl, conf);
  }

  const mapMembers = new Map(allMembers.map(m => [m.csa_id, m]));

  const pool: PlayerPool[] = [];
  for (const player of players) {
    if (player.status !== 'ROS' && player.status !== 'IR') continue;

    const mem = mapMembers.get(player.Player.csa_id);
    const franchiseData = player.Franchise ? (franchiseMap.get(player.Franchise.id) || null) : null;
    pool.push({
      player,
      member: mem ? { avatar_url: mem.avatar_url, discord_id: mem.discord_id } : { avatar_url: null, discord_id: player.Player.discord_id },
      franchise: franchiseData,
      franchise_conf: player.Franchise ? (franchiseConfMap.get(player.Franchise.id) || null) : null,
    });
  }

  cachedPlayerPool = pool;
  poolCacheExpiry = Date.now() + 4 * 60 * 1000;
  
  return pool;
}

export async function generateCard(
  poolEntry: PlayerPool,
  rarity: Rarity,
  seasonOverride?: { id: number; number: number },
): Promise<Omit<Card, 'created_at'>> {
  const { player } = poolEntry;

  let seasonId: number;
  let seasonNumber: number;
  if (seasonOverride) {
    seasonId = seasonOverride.id;
    seasonNumber = seasonOverride.number;
  } else {
    const season = await getCurrentSeason();
    seasonId = season?.id || 1;
    seasonNumber = season?.number || 1;
  }

  const gpg = (player.active_salary / 5000) * 0.5;
  const apg = (player.active_salary / 5000) * 0.4;
  const svpg = (player.active_salary / 5000) * 0.8;
  const winPct = 0.5;

  const mult = RARITY_STAT_MULTIPLIER[rarity];
  
  const cardStats = {
    gpg: Math.round(gpg * mult * 1000) / 1000,
    apg: Math.round(apg * mult * 1000) / 1000,
    svpg: Math.round(svpg * mult * 1000) / 1000,
    win_pct: Math.round(Math.min(winPct * mult, 1) * 1000) / 1000,
  };

  const cardId = generateCardId(player.Player.csa_id, seasonId, rarity);
  
  // Try to get avatar
  let avatarUrl = poolEntry.member?.avatar_url || null;
  if (!avatarUrl) {
    try {
      const member = await getMemberById(player.Player.csa_id);
      if (member?.avatar_url) avatarUrl = member.avatar_url;
    } catch { /* ignore */ }
  }

  const franchiseLogo = poolEntry.franchise?.logo
    ? (poolEntry.franchise.logo.startsWith('http') ? poolEntry.franchise.logo : `https://api.playcsa.com${poolEntry.franchise.logo}`)
    : null;

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
    franchise_color: poolEntry.franchise?.color || null,
    franchise_logo_url: franchiseLogo,
    franchise_conf: poolEntry.franchise_conf || null,
    tier_name: player.tier || null,
    tier_abbr: player.tier || null,
    rarity,
    card_type: 'player',
    stat_gpg: cardStats.gpg,
    stat_apg: cardStats.apg,
    stat_svpg: cardStats.svpg,
    stat_win_pct: cardStats.win_pct,
    salary: player.active_salary,
    overall_rating: 0,
  };

  // Insert into DB (idempotent)
  insertCard(card);
  
  return card;
}

export function generateGMCard(gmData: GMCardData): Omit<Card, 'created_at'> {
  const card: Omit<Card, 'created_at'> = {
    id: gmData.id,
    player_csa_id: gmData.gm_csa_id,
    player_name: gmData.player_name,
    player_discord_id: null,
    player_avatar_url: gmData.player_avatar_url,
    season_id: gmData.season_id,
    season_number: gmData.season_number,
    franchise_id: gmData.franchise_id,
    franchise_name: gmData.franchise_name,
    franchise_abbr: gmData.franchise_abbr,
    franchise_color: gmData.franchise_color,
    franchise_logo_url: gmData.franchise_logo_url,
    franchise_conf: gmData.franchise_conf,
    tier_name: null,
    tier_abbr: null,
    rarity: 'prismatic',
    card_type: 'gm',
    stat_gpg: 0,
    stat_apg: 0,
    stat_svpg: 0,
    stat_win_pct: 0,
    salary: 0,
    overall_rating: 99,
  };
  insertCard(card);
  return card;
}

export async function generatePackCards(count: number = 5, packType: PackType = 'standard', franchiseId?: number): Promise<Omit<Card, 'created_at'>[]> {
  const [pool, gmPool] = await Promise.all([getPlayerPool(), getGMPool()]);
  if (pool.length === 0) throw new Error('No players available for card generation');

  const gmCsaIds = new Set(gmPool.map(g => g.gm_csa_id));
  const playerPool = pool.filter(e => !gmCsaIds.has(e.player.Player.csa_id));
  const allWcPool = playerPool.filter(e => e.player.tier?.toLowerCase().replace(/[\s_]+/g, '') === 'worldclass');
  const allNormalPool = playerPool.filter(e => e.player.tier?.toLowerCase().replace(/[\s_]+/g, '') !== 'worldclass');

  // Filter by franchise if specified (fall back to full pools if franchise has no cards)
  const wcPool = franchiseId
    ? (allWcPool.filter(e => e.player.Franchise?.id === franchiseId).length > 0
        ? allWcPool.filter(e => e.player.Franchise?.id === franchiseId)
        : allWcPool)
    : allWcPool;
  const normalPool = franchiseId
    ? (allNormalPool.filter(e => e.player.Franchise?.id === franchiseId).length > 0
        ? allNormalPool.filter(e => e.player.Franchise?.id === franchiseId)
        : allNormalPool)
    : allNormalPool;
  const filteredGmPool = franchiseId
    ? (gmPool.filter(g => g.franchise_id === franchiseId).length > 0
        ? gmPool.filter(g => g.franchise_id === franchiseId)
        : gmPool)
    : gmPool;

  const cards: Omit<Card, 'created_at'>[] = [];
  const usedPlayerIds = new Set<number>();
  const usedGMIds = new Set<string>();

  function pickPlayer(src: PlayerPool[]): PlayerPool {
    let entry: PlayerPool;
    let attempts = 0;
    do {
      entry = src[Math.floor(Math.random() * src.length)];
      attempts++;
    } while (usedPlayerIds.has(entry.player.Player.csa_id) && attempts < 50);
    return entry;
  }

  function pickGM(src: GMCardData[]): GMCardData {
    let entry: GMCardData;
    let attempts = 0;
    do {
      entry = src[Math.floor(Math.random() * src.length)];
      attempts++;
    } while (usedGMIds.has(entry.id) && attempts < 50);
    return entry;
  }

  const season = await import('./csa-api').then(m => m.getCurrentSeason());
  const seasonOverride = season ? { id: season.id, number: season.number } : undefined;

  for (let i = 0; i < count; i++) {
    const rarity = rollRarityForPack(packType);

    if (rarity === 'prismatic') {
      // Prismatic: eligible pool = WC players + GMs (fallback to all players if both empty)
      const hasPrismaticSpecial = wcPool.length > 0 || filteredGmPool.length > 0;

      if (hasPrismaticSpecial) {
        // Weighted pick: WC players vs GMs
        const totalOptions = wcPool.length + filteredGmPool.length;
        const roll = Math.floor(Math.random() * totalOptions);

        if (roll < wcPool.length) {
          const entry = pickPlayer(wcPool);
          usedPlayerIds.add(entry.player.Player.csa_id);
          cards.push(await generateCard(entry, 'prismatic', seasonOverride));
        } else {
          const entry = pickGM(filteredGmPool);
          usedGMIds.add(entry.id);
          cards.push(generateGMCard(entry));
        }
      } else {
        // Fallback: pick from all players at prismatic
        const entry = pickPlayer(normalPool.length > 0 ? normalPool : pool);
        usedPlayerIds.add(entry.player.Player.csa_id);
        cards.push(await generateCard(entry, 'prismatic', seasonOverride));
      }
    } else {
      // Non-prismatic: regular players only (no WC, no GMs)
      const pickablePool = normalPool.length > 0 ? normalPool : pool;
      const entry = pickPlayer(pickablePool);
      usedPlayerIds.add(entry.player.Player.csa_id);
      cards.push(await generateCard(entry, rarity, seasonOverride));
    }
  }

  // Sort by rarity (best last for reveal)
  cards.sort((a, b) => RARITY_ORDER.indexOf(a.rarity as Rarity) - RARITY_ORDER.indexOf(b.rarity as Rarity));

  return cards;
}

// ---- GM Cards ----

export interface GMCardData {
  id: string;
  card_type: 'gm';
  gm_csa_id: number;
  player_name: string;
  player_avatar_url: string | null;
  franchise_id: number;
  franchise_name: string;
  franchise_abbr: string | null;
  franchise_logo_url: string | null;
  franchise_color: string | null;
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
  season_id: number;
}

let cachedGMPool: GMCardData[] | null = null;
let gmPoolCacheExpiry = 0;

export async function getGMPool(): Promise<GMCardData[]> {
  if (cachedGMPool && Date.now() < gmPoolCacheExpiry) return cachedGMPool;

  const season = await getCurrentSeason();

  const [franchises, franchiseDetails, allMembers] = await Promise.all([
    getFranchises(),
    getFranchiseDetails(season?.id),
    getMembers(),
  ]);

  const franchiseConfMap = new Map(franchiseDetails.map(fd => [fd.Franchise.id, fd.conf]));
  const memberMap = new Map(allMembers.map(m => [m.csa_id, m]));

  const gmCards: GMCardData[] = [];

  for (const franchise of franchises) {
    if (!franchise.active || !franchise.GM?.csa_id) continue;

    const gm = franchise.GM;
    const member = memberMap.get(gm.csa_id);
    const logoUrl = franchise.logo
      ? (franchise.logo.startsWith('http') ? franchise.logo : `https://api.playcsa.com${franchise.logo}`)
      : null;

    gmCards.push({
      id: `gm-${franchise.id}-s${season?.number ?? 1}`,
      card_type: 'gm',
      gm_csa_id: gm.csa_id,
      player_name: gm.csa_name,
      player_avatar_url: member?.avatar_url ?? null,
      franchise_id: franchise.id,
      franchise_name: franchise.display_name ?? franchise.name,
      franchise_abbr: franchise.abbr,
      franchise_logo_url: logoUrl,
      franchise_color: franchise.color,
      franchise_conf: franchiseConfMap.get(franchise.id) ?? null,
      tier_name: null,
      tier_abbr: null,
      rarity: 'prismatic',
      stat_gpg: 0,
      stat_apg: 0,
      stat_svpg: 0,
      stat_win_pct: 0,
      salary: 0,
      overall_rating: 99,
      season_number: season?.number ?? 1,
      season_id: season?.id ?? 1,
    });
  }

  cachedGMPool = gmCards;
  gmPoolCacheExpiry = Date.now() + 4 * 60 * 1000;
  return gmCards;
}
