const CSA_API_BASE = 'https://api.playcsa.com';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function apiGet<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(endpoint, CSA_API_BASE);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.CSA_API_KEY) {
    headers['X-API-KEY'] = process.env.CSA_API_KEY;
  }

  const res = await fetch(url.toString(), { headers, next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`CSA API error: ${res.status} ${res.statusText} for ${endpoint}`);
  }
  return res.json();
}

async function apiGetAllPages<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  const size = 500;
  
  while (true) {
    const res = await apiGet<PaginatedResponse<T>>(endpoint, { ...params, page, size });
    allData.push(...res.data);
    if (page >= res.total_pages) break;
    page++;
  }
  
  return allData;
}

// ---- Member endpoints ----

export interface CSAMember {
  csa_id: number;
  discord_id: string;
  discord_user: string;
  csa_name: string;
  date_joined: string | null;
  in_guild: boolean | null;
  avatar_url: string | null;
  display_id: string;
}

export async function getMembers(params?: { discord_id?: string; csa_name?: string; in_guild?: boolean }): Promise<CSAMember[]> {
  const cacheKey = `members_${JSON.stringify(params)}`;
  const cached = getCached<CSAMember[]>(cacheKey);
  if (cached) return cached;

  const data = await apiGetAllPages<CSAMember>('/members', { ...params });
  setCache(cacheKey, data, 15 * 60 * 1000);
  return data;
}

export async function getMemberById(csaId: number): Promise<CSAMember | null> {
  const cacheKey = `member_${csaId}`;
  const cached = getCached<CSAMember>(cacheKey);
  if (cached) return cached;

  try {
    const member = await apiGet<CSAMember>(`/members/${csaId}`);
    setCache(cacheKey, member);
    return member;
  } catch {
    return null;
  }
}

export async function getMemberByDiscordId(discordId: string): Promise<CSAMember | null> {
  const cacheKey = `member_discord_${discordId}`;
  const cached = getCached<CSAMember>(cacheKey);
  if (cached) return cached;

  try {
    const res = await apiGet<PaginatedResponse<CSAMember>>('/members', { discord_id: discordId });
    const member = res.data?.[0] || null;
    if (member) setCache(cacheKey, member);
    return member;
  } catch {
    return null;
  }
}

// ---- Franchise endpoints ----

export interface CSAFranchise {
  id: number;
  active: boolean;
  name: string;
  abbr: string;
  slot_id: number | null;
  GM: { csa_id: number; discord_id: string; csa_name: string };
  logo: string | null;
  display_city: string | null;
  display_name: string | null;
  color: string | null;
}

export async function getFranchises(active = true): Promise<CSAFranchise[]> {
  const cacheKey = `franchises_${active}`;
  const cached = getCached<CSAFranchise[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSAFranchise>>('/franchises', { active, size: 500 });
  setCache(cacheKey, res.data);
  return res.data;
}

export async function getFranchiseById(franchiseId: number): Promise<CSAFranchise | null> {
  try {
    return await apiGet<CSAFranchise>(`/franchises/${franchiseId}`);
  } catch {
    return null;
  }
}

// ---- Franchise Details (with rosters) ----

export interface CSALeaguePlayerSimple {
  Player: { csa_id: number; discord_id: string; csa_name: string };
  status: string;
  base_salary: number;
  active_salary: number;
  captain: boolean;
}

export interface CSATierRoster {
  Tier: { id: number; name: string; abbr: string; order: number | null };
  Team: CSALeaguePlayerSimple[] | null;
}

export interface CSAFranchiseDetails {
  id: number;
  season_id: number;
  Franchise: { id: number; name: string; abbr: string; active: boolean; GM: { csa_id: number; discord_id: string; csa_name: string } };
  conf: string;
  AGMs: { csa_id: number; discord_id: string; csa_name: string }[] | null;
  Rosters: CSATierRoster[] | null;
}

export async function getFranchiseDetails(seasonId?: number, franchiseId?: number): Promise<CSAFranchiseDetails[]> {
  const cacheKey = `franchise_details_${seasonId}_${franchiseId}`;
  const cached = getCached<CSAFranchiseDetails[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSAFranchiseDetails>>('/franchisesdetails', {
    season_id: seasonId,
    franchise_id: franchiseId,
    size: 500,
  });
  setCache(cacheKey, res.data, 15 * 60 * 1000);
  return res.data;
}

// ---- Tier endpoints ----

export interface CSATier {
  id: number;
  name: string;
  abbr: string;
  logo: string | null;
  color: string | null;
  order: number | null;
}

export async function getTiers(): Promise<CSATier[]> {
  const cacheKey = 'tiers';
  const cached = getCached<CSATier[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSATier>>('/general/tiers', { size: 100 });
  setCache(cacheKey, res.data);
  return res.data;
}

// ---- Season endpoints ----

export interface CSASeason {
  id: number;
  number: number;
  current: boolean;
  signups_open: string | null;
  draft_date: string | null;
  current_stage: string | null;
}

export async function getCurrentSeason(): Promise<CSASeason | null> {
  const cacheKey = 'current_season';
  const cached = getCached<CSASeason>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSASeason>>('/general/seasons', { current: true });
  const season = res.data?.[0] || null;
  if (season) setCache(cacheKey, season, 30 * 60 * 1000);
  return season;
}

export async function getSeasons(): Promise<CSASeason[]> {
  const cacheKey = 'all_seasons';
  const cached = getCached<CSASeason[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSASeason>>('/general/seasons', { size: 100 });
  setCache(cacheKey, res.data, 30 * 60 * 1000);
  return res.data;
}

// ---- League Players ----

export interface CSALeaguePlayer {
  id: number;
  season_id: number;
  Player: { csa_id: number; discord_id: string; csa_name: string };
  base_salary: number;
  active_salary: number;
  status: string;
  Franchise: { id: number; name: string; abbr: string } | null;
  tier: string | null;
  active: boolean;
  release_date: string | null;
}

export async function getLeaguePlayers(params?: {
  seasonId?: number;
  csaId?: number;
  franchiseId?: number;
  tierId?: number;
  active?: boolean;
}): Promise<CSALeaguePlayer[]> {
  const cacheKey = `league_players_${JSON.stringify(params)}`;
  const cached = getCached<CSALeaguePlayer[]>(cacheKey);
  if (cached) return cached;

  const data = await apiGetAllPages<CSALeaguePlayer>('/leagueplayers', {
    season_id: params?.seasonId,
    csa_id: params?.csaId,
    franchise_id: params?.franchiseId,
    tier_id: params?.tierId,
    active: params?.active,
  });
  setCache(cacheKey, data, 10 * 60 * 1000);
  return data;
}

// ---- Player Stats ----

export interface CSAPlayerCoreAvgs {
  LeaguePlayer: { leagueplayer_id: number; season_id: number; Member: { csa_id: number; discord_id: string; csa_name: string } };
  match_type: string;
  tier: { id: number; name: string; abbr: string; order: number | null } | null;
  franchise_ids: number[];
  games_played: number;
  win_pct: number;
  ppg: number;
  gpg: number;
  apg: number;
  ggpg: number;
  svpg: number;
  shpg: number;
  shapg: number;
  gapg: number;
  dipg: number;
  dtpg: number;
}

export async function getPlayerCoreAvgs(params?: {
  csaId?: number;
  matchType?: string;
  tierId?: number;
  seasonId?: number;
}): Promise<CSAPlayerCoreAvgs[]> {
  const cacheKey = `player_core_avgs_${JSON.stringify(params)}`;
  const cached = getCached<CSAPlayerCoreAvgs[]>(cacheKey);
  if (cached) return cached;

  const data = await apiGetAllPages<CSAPlayerCoreAvgs>('/stats/player/core/avgs', {
    csa_id: params?.csaId,
    match_type: params?.matchType,
    tier_id: params?.tierId,
    season_id: params?.seasonId,
  });
  setCache(cacheKey, data, 15 * 60 * 1000);
  return data;
}

export interface CSAPlayerCoreTotals {
  LeaguePlayer: { leagueplayer_id: number; season_id: number; Member: { csa_id: number; discord_id: string; csa_name: string } };
  match_type: string;
  tier: { id: number; name: string; abbr: string; order: number | null } | null;
  franchise_ids: number[];
  games_played: number;
  wins: number;
  losses: number;
  mvps: number;
  time_played: number;
  points: number;
  goals: number;
  assists: number;
  goals_gen: number;
  saves: number;
  shots: number;
  shots_against: number;
  goals_against: number;
  demo_inflicted: number;
  demo_taken: number;
}

export async function getPlayerCoreTotals(params?: {
  csaId?: number;
  matchType?: string;
  tierId?: number;
  seasonId?: number;
}): Promise<CSAPlayerCoreTotals[]> {
  const cacheKey = `player_core_totals_${JSON.stringify(params)}`;
  const cached = getCached<CSAPlayerCoreTotals[]>(cacheKey);
  if (cached) return cached;

  const data = await apiGetAllPages<CSAPlayerCoreTotals>('/stats/player/core/totals', {
    csa_id: params?.csaId,
    match_type: params?.matchType,
    tier_id: params?.tierId,
    season_id: params?.seasonId,
  });
  setCache(cacheKey, data, 15 * 60 * 1000);
  return data;
}

// ---- Standings ----

export interface CSATierStanding {
  season_id: number;
  Franchise: { id: number; name: string; abbr: string };
  Tier: { id: number; name: string; abbr: string; order: number | null };
  match_type: string;
  series_played: number;
  series_win: number;
  series_loss: number;
  series_win_pct: number;
  games_played: number;
  games_win: number;
  games_loss: number;
  games_win_pct: number;
  points: number | null;
}

export async function getTierStandings(seasonId?: number, tierId?: number, matchType?: string): Promise<CSATierStanding[]> {
  const cacheKey = `tier_standings_${seasonId}_${tierId}_${matchType}`;
  const cached = getCached<CSATierStanding[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<PaginatedResponse<CSATierStanding>>('/stats/standings/tier', {
    season_id: seasonId,
    tier_id: tierId,
    match_type: matchType,
    size: 500,
  });
  setCache(cacheKey, res.data);
  return res.data;
}
