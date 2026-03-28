import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tradingcards.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);
  return db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      csa_id INTEGER UNIQUE,
      csa_name TEXT,
      discord_username TEXT NOT NULL,
      avatar_url TEXT,
      coins INTEGER NOT NULL DEFAULT 500,
      packs_opened_today INTEGER NOT NULL DEFAULT 0,
      last_pack_date TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      player_csa_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      player_discord_id TEXT,
      player_avatar_url TEXT,
      season_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      franchise_id INTEGER,
      franchise_name TEXT,
      franchise_abbr TEXT,
      franchise_color TEXT,
      franchise_logo_url TEXT,
      franchise_conf TEXT,
      tier_name TEXT,
      tier_abbr TEXT,
      rarity TEXT NOT NULL CHECK(rarity IN ('bronze','silver','gold','platinum','diamond','holographic','prismatic')),
      card_type TEXT NOT NULL DEFAULT 'player',
      stat_gpg REAL NOT NULL DEFAULT 0,
      stat_apg REAL NOT NULL DEFAULT 0,
      stat_svpg REAL NOT NULL DEFAULT 0,
      stat_win_pct REAL NOT NULL DEFAULT 0,
      salary INTEGER NOT NULL DEFAULT 0,
      overall_rating INTEGER NOT NULL DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT NOT NULL DEFAULT 'pack' CHECK(source IN ('pack','trade','marketplace','reward')),
      is_listed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );

    CREATE TABLE IF NOT EXISTS packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_type TEXT NOT NULL DEFAULT 'standard' CHECK(pack_type IN ('standard','premium','tier','franchise')),
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pack_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      user_card_id INTEGER NOT NULL,
      FOREIGN KEY (pack_id) REFERENCES packs(id),
      FOREIGN KEY (card_id) REFERENCES cards(id),
      FOREIGN KEY (user_card_id) REFERENCES user_cards(id)
    );

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      user_card_id INTEGER NOT NULL,
      card_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','cancelled')),
      buyer_id INTEGER,
      listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sold_at DATETIME,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (user_card_id) REFERENCES user_cards(id),
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      sender_coins INTEGER NOT NULL DEFAULT 0,
      receiver_coins INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trade_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_id INTEGER NOT NULL,
      user_card_id INTEGER NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('sender','receiver')),
      FOREIGN KEY (trade_id) REFERENCES trades(id),
      FOREIGN KEY (user_card_id) REFERENCES user_cards(id)
    );

    CREATE TABLE IF NOT EXISTS coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('pack_purchase','marketplace_sale','marketplace_buy','trade','reward','daily_bonus')),
      description TEXT,
      reference_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pack_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pack_type TEXT NOT NULL DEFAULT 'standard',
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS showcase_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_card_id INTEGER NOT NULL,
      position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (user_card_id) REFERENCES user_cards(id),
      UNIQUE(user_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);

    CREATE TABLE IF NOT EXISTS featured_cards (
      position INTEGER PRIMARY KEY CHECK(position BETWEEN 1 AND 3),
      card_id TEXT,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );
  `);

  // Migrations for existing DBs
  for (const col of [
    'ALTER TABLE cards ADD COLUMN franchise_logo_url TEXT',
    'ALTER TABLE cards ADD COLUMN franchise_conf TEXT',
    'ALTER TABLE trades ADD COLUMN sender_coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE trades ADD COLUMN receiver_coins INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN last_daily_bonus DATE',
    'ALTER TABLE users ADD COLUMN last_prestige_grant DATE',
    "ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'player'",
    'ALTER TABLE trades ADD COLUMN expires_at DATETIME',
    'ALTER TABLE marketplace_listings ADD COLUMN expires_at DATETIME',
    'ALTER TABLE users ADD COLUMN login_streak INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN last_login_date TEXT',
    'ALTER TABLE user_cards ADD COLUMN is_reward_card INTEGER NOT NULL DEFAULT 0',
  ]) {
    try { db.exec(col); } catch { /* already exists */ }
  }

  // New tables for features
  db.exec(`
    CREATE TABLE IF NOT EXISTS full_set_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_csa_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      coins_rewarded INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, player_csa_id, season_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reward_coins INTEGER NOT NULL DEFAULT 0,
      reward_pack_type TEXT,
      target INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge_id INTEGER NOT NULL,
      period_key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      completed_at DATETIME,
      claimed_at DATETIME,
      UNIQUE(user_id, challenge_id, period_key),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id)
    );

    CREATE TABLE IF NOT EXISTS shop_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_key TEXT NOT NULL,
      item_type TEXT NOT NULL,
      pack_type TEXT,
      coin_amount INTEGER,
      price INTEGER NOT NULL,
      rotation_starts DATETIME NOT NULL,
      rotation_ends DATETIME NOT NULL,
      stock INTEGER,
      sold_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shop_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      price INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (slot_id) REFERENCES shop_slots(id)
    );

    CREATE TABLE IF NOT EXISTS franchise_set_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      set_type TEXT NOT NULL,
      franchise_id INTEGER NOT NULL,
      rarity TEXT,
      season_id INTEGER NOT NULL,
      reward_card_id TEXT,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, set_type, franchise_id, rarity, season_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Back-fill expires_at for trades that don't have it (7 day TTL)
  db.exec(`UPDATE trades SET expires_at = datetime(created_at, '+7 days') WHERE expires_at IS NULL AND status = 'pending'`);
  // Back-fill expires_at for active listings that don't have it (30 day TTL)
  db.exec(`UPDATE marketplace_listings SET expires_at = datetime(listed_at, '+30 days') WHERE expires_at IS NULL AND status = 'active'`);

  // Clamp any existing listings above the max price to 1,000,000
  db.exec(`UPDATE marketplace_listings SET price = 1000000 WHERE price > 1000000 AND status = 'active'`);

  // Expand coin_transactions type CHECK if it's still the old restrictive one
  const ctInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='coin_transactions'").get() as { sql: string } | undefined;
  if (ctInfo?.sql.includes('type IN (')) {
    db.exec(`
      ALTER TABLE coin_transactions RENAME TO coin_transactions_old;
      CREATE TABLE coin_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        reference_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT INTO coin_transactions SELECT * FROM coin_transactions_old;
      DROP TABLE coin_transactions_old;
    `);
  }

  // Remove restrictive CHECK from packs.pack_type to support new pack types
  const packsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='packs'").get() as { sql: string } | undefined;
  if (packsInfo?.sql.includes('CHECK(pack_type IN')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      DROP TABLE IF EXISTS packs_new;
      CREATE TABLE packs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        pack_type TEXT NOT NULL DEFAULT 'standard',
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT INTO packs_new SELECT * FROM packs;
      DROP TABLE packs;
      ALTER TABLE packs_new RENAME TO packs;
    `);
    db.pragma('foreign_keys = ON');
  }

  // Migrate featured_cards from old csa_id+rarity schema to card_id schema
  const featuredInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='featured_cards'").get() as { sql: string } | undefined;
  if (featuredInfo?.sql.includes('csa_id')) {
    db.exec(`DROP TABLE featured_cards;
      CREATE TABLE featured_cards (
        position INTEGER PRIMARY KEY CHECK(position BETWEEN 1 AND 3),
        card_id TEXT,
        FOREIGN KEY (card_id) REFERENCES cards(id)
      );`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_cards_card ON user_cards(card_id);
    CREATE INDEX IF NOT EXISTS idx_cards_player ON cards(player_csa_id);
    CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_cards_season ON cards(season_id);
    CREATE INDEX IF NOT EXISTS idx_cards_franchise ON cards(franchise_id);
    CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_listings(status);
    CREATE INDEX IF NOT EXISTS idx_trades_sender ON trades(sender_id);
    CREATE INDEX IF NOT EXISTS idx_trades_receiver ON trades(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_packs_user ON packs(user_id);
    CREATE INDEX IF NOT EXISTS idx_pack_inventory_user ON pack_inventory(user_id);
  `);
}

// ---- User operations ----

export interface User {
  id: number;
  discord_id: string;
  csa_id: number | null;
  csa_name: string | null;
  discord_username: string;
  avatar_url: string | null;
  coins: number;
  packs_opened_today: number;
  last_pack_date: string | null;
  is_admin: number;
  created_at: string;
  last_login: string;
  login_streak: number;
  last_login_date: string | null;
  last_daily_bonus: string | null;
}

export const SUPER_ADMIN_CSA_ID = 121;

export function upsertUser(discordId: string, discordUsername: string, avatarUrl: string | null, csaId?: number, csaName?: string): User {
  const database = getDb();
  const startingCoins = parseInt(process.env.STARTING_COINS || '500', 10);

  const stmt = database.prepare(`
    INSERT INTO users (discord_id, discord_username, avatar_url, csa_id, csa_name, coins, last_login)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(discord_id) DO UPDATE SET
      discord_username = excluded.discord_username,
      avatar_url = excluded.avatar_url,
      csa_id = COALESCE(excluded.csa_id, users.csa_id),
      csa_name = COALESCE(excluded.csa_name, users.csa_name),
      last_login = CURRENT_TIMESTAMP
    RETURNING *
  `);

  return stmt.get(discordId, discordUsername, avatarUrl, csaId ?? null, csaName ?? null, startingCoins) as User;
}

export function getUserById(id: number): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByDiscordId(discordId: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId) as User | undefined;
}

export function updateCoins(userId: number, amount: number): void {
  getDb().prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
}

export function getPacksOpenedToday(userId: number): number {
  const user = getUserById(userId);
  if (!user) return 0;
  
  const today = new Date().toISOString().split('T')[0];
  if (user.last_pack_date !== today) {
    getDb().prepare('UPDATE users SET packs_opened_today = 0, last_pack_date = ? WHERE id = ?').run(today, userId);
    return 0;
  }
  return user.packs_opened_today;
}

export function incrementPacksOpened(userId: number): void {
  const today = new Date().toISOString().split('T')[0];
  getDb().prepare(`
    UPDATE users SET packs_opened_today = packs_opened_today + 1, last_pack_date = ? WHERE id = ?
  `).run(today, userId);
}

// ---- Card operations ----

export interface Card {
  id: string;
  player_csa_id: number;
  player_name: string;
  player_discord_id: string | null;
  player_avatar_url: string | null;
  season_id: number;
  season_number: number;
  franchise_id: number | null;
  franchise_name: string | null;
  franchise_abbr: string | null;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_conf: string | null;
  tier_name: string | null;
  tier_abbr: string | null;
  rarity: string;
  card_type: string;
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  created_at: string;
}

export interface UserCard {
  id?: number;
  user_card_id?: number;
  user_id: number;
  card_id: string;
  acquired_at: string;
  source: string;
  is_listed: number;
  is_reward_card: number;
}

export type UserCardWithDetails = UserCard & Card;
export type UserCardWithCopyCount = UserCardWithDetails & { copy_count: number };

export function insertCard(card: Omit<Card, 'created_at'>): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO cards (id, player_csa_id, player_name, player_discord_id, player_avatar_url,
      season_id, season_number, franchise_id, franchise_name, franchise_abbr, franchise_color,
      franchise_logo_url, franchise_conf, tier_name, tier_abbr, rarity, card_type,
      stat_gpg, stat_apg, stat_svpg, stat_win_pct, salary, overall_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    card.id, card.player_csa_id, card.player_name, card.player_discord_id, card.player_avatar_url,
    card.season_id, card.season_number, card.franchise_id, card.franchise_name, card.franchise_abbr,
    card.franchise_color, card.franchise_logo_url, card.franchise_conf, card.tier_name, card.tier_abbr,
    card.rarity, card.card_type ?? 'player',
    card.stat_gpg, card.stat_apg, card.stat_svpg, card.stat_win_pct, card.salary, card.overall_rating
  );
}

export function syncFranchiseDataOnCards(franchiseId: number, color: string | null, logoUrl: string | null, conf: string | null): void {
  if (!color && !logoUrl && !conf) return;
  getDb().prepare(`
    UPDATE cards SET
      franchise_color     = CASE WHEN ? IS NOT NULL THEN ? ELSE franchise_color END,
      franchise_logo_url  = CASE WHEN ? IS NOT NULL THEN ? ELSE franchise_logo_url END,
      franchise_conf      = CASE WHEN ? IS NOT NULL THEN ? ELSE franchise_conf END
    WHERE franchise_id = ?
  `).run(color, color, logoUrl, logoUrl, conf, conf, franchiseId);
}

export function addCardToUser(userId: number, cardId: string, source: string = 'pack'): number {
  const result = getDb().prepare(`
    INSERT INTO user_cards (user_id, card_id, source) VALUES (?, ?, ?)
  `).run(userId, cardId, source);
  return result.lastInsertRowid as number;
}

export function getUserCards(userId: number, filters?: {
  rarity?: string;
  franchiseId?: number;
  seasonId?: number;
  tierAbbr?: string;
  search?: string;
  sort?: 'rarity' | 'name_asc' | 'name_desc' | 'newest' | 'oldest';
  cardType?: 'player' | 'gm';
}): UserCardWithCopyCount[] {
  let query = `
    SELECT uc.id as user_card_id, uc.user_id, uc.card_id, uc.acquired_at, uc.source, uc.is_listed,
      c.id, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at,
      (SELECT COUNT(*) FROM user_cards WHERE card_id = c.id) as copy_count
    FROM user_cards uc
    JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
  `;
  const params: (string | number)[] = [userId];

  if (filters?.rarity) {
    query += ' AND c.rarity = ?';
    params.push(filters.rarity);
  }
  if (filters?.franchiseId) {
    query += ' AND c.franchise_id = ?';
    params.push(filters.franchiseId);
  }
  if (filters?.seasonId) {
    query += ' AND c.season_id = ?';
    params.push(filters.seasonId);
  }
  if (filters?.tierAbbr) {
    query += ' AND c.tier_abbr = ?';
    params.push(filters.tierAbbr);
  }
  if (filters?.search) {
    query += ' AND c.player_name LIKE ?';
    params.push(`%${filters.search}%`);
  }
  if (filters?.cardType) {
    query += ' AND c.card_type = ?';
    params.push(filters.cardType);
  }

  const orderMap: Record<string, string> = {
    name_asc: 'c.player_name ASC',
    name_desc: 'c.player_name DESC',
    newest: 'uc.acquired_at DESC',
    oldest: 'uc.acquired_at ASC',
  };
  query += ` ORDER BY ${orderMap[filters?.sort ?? ''] ?? `CASE c.rarity WHEN 'prismatic' THEN 7 WHEN 'holographic' THEN 6 WHEN 'diamond' THEN 5 WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END DESC, uc.acquired_at DESC`}`;

  return getDb().prepare(query).all(...params) as UserCardWithCopyCount[];
}

export function getCollectionRarityCounts(userId: number): { rarity: string; count: number }[] {
  return getDb().prepare(`
    SELECT c.rarity, COUNT(*) as count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
    GROUP BY c.rarity
  `).all(userId) as { rarity: string; count: number }[];
}

export function getCardById(cardId: string): Card | undefined {
  return getDb().prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as Card | undefined;
}

export function getUserCardById(userCardId: number): (UserCard & { card: Card }) | undefined {
  const uc = getDb().prepare('SELECT * FROM user_cards WHERE id = ?').get(userCardId) as UserCard | undefined;
  if (!uc) return undefined;
  const card = getCardById(uc.card_id);
  if (!card) return undefined;
  return { ...uc, card };
}

// ---- Pack operations ----

export function createPack(userId: number, packType: string = 'standard'): number {
  const result = getDb().prepare('INSERT INTO packs (user_id, pack_type) VALUES (?, ?)').run(userId, packType);
  return result.lastInsertRowid as number;
}

export function addCardToPack(packId: number, cardId: string, userCardId: number): void {
  getDb().prepare('INSERT INTO pack_cards (pack_id, card_id, user_card_id) VALUES (?, ?, ?)').run(packId, cardId, userCardId);
}

export function getPackHistory(userId: number): {
  id: number;
  pack_type: string;
  opened_at: string;
  cards: { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null }[];
}[] {
  const database = getDb();
  const packs = database.prepare(
    'SELECT id, pack_type, opened_at FROM packs WHERE user_id = ? ORDER BY opened_at DESC LIMIT 100'
  ).all(userId) as { id: number; pack_type: string; opened_at: string }[];

  return packs.map(pack => {
    const cards = database.prepare(`
      SELECT c.rarity, c.player_name, c.player_avatar_url, c.franchise_color
      FROM pack_cards pc JOIN cards c ON pc.card_id = c.id
      WHERE pc.pack_id = ?
    `).all(pack.id) as { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null }[];
    return { ...pack, cards };
  });
}

// ---- Marketplace ----

export interface MarketplaceListing {
  id: number;
  seller_id: number;
  user_card_id: number;
  card_id: string;
  price: number;
  status: string;
  buyer_id: number | null;
  listed_at: string;
  sold_at: string | null;
}

export type ListingWithDetails = MarketplaceListing & Card & { seller_name: string; seller_avatar: string | null };

export function createListing(sellerId: number, userCardId: number, cardId: string, price: number): number {
  const db = getDb();
  let listingId!: number;
  db.transaction(() => {
    const card = db.prepare('SELECT is_listed, is_reward_card FROM user_cards WHERE id = ? AND user_id = ?').get(userCardId, sellerId) as { is_listed: number; is_reward_card: number } | undefined;
    if (!card) throw new Error('Card not found');
    if (card.is_listed) throw new Error('Card is already listed');
    if (card.is_reward_card) throw new Error('Set reward cards cannot be listed on the marketplace');
    db.prepare('UPDATE user_cards SET is_listed = 1 WHERE id = ?').run(userCardId);
    const result = db.prepare(`INSERT INTO marketplace_listings (seller_id, user_card_id, card_id, price, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+30 days'))`).run(sellerId, userCardId, cardId, price);
    listingId = result.lastInsertRowid as number;
  })();
  return listingId;
}

export function getActiveListings(filters?: {
  rarity?: string;
  franchiseId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: string;
  cardType?: string;
}, limit = 50, offset = 0): ListingWithDetails[] {
  const database = getDb();
  // Auto-cancel expired listings
  const expired = database.prepare(`SELECT id, user_card_id FROM marketplace_listings WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP`).all() as { id: number; user_card_id: number }[];
  for (const { id, user_card_id } of expired) {
    database.prepare(`UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ?`).run(id);
    database.prepare(`UPDATE user_cards SET is_listed = 0 WHERE id = ?`).run(user_card_id);
  }

  let query = `
    SELECT ml.*, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at,
      (SELECT COUNT(*) FROM user_cards WHERE card_id = c.id) as copy_count,
      COALESCE(u.csa_name, u.discord_username) as seller_name, u.avatar_url as seller_avatar
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    JOIN users u ON ml.seller_id = u.id
    WHERE ml.status = 'active'
  `;
  const params: (string | number)[] = [];

  if (filters?.rarity) {
    query += ' AND c.rarity = ?';
    params.push(filters.rarity);
  }
  if (filters?.franchiseId) {
    query += ' AND c.franchise_id = ?';
    params.push(filters.franchiseId);
  }
  if (filters?.minPrice) {
    query += ' AND ml.price >= ?';
    params.push(filters.minPrice);
  }
  if (filters?.maxPrice) {
    query += ' AND ml.price <= ?';
    params.push(filters.maxPrice);
  }
  if (filters?.search) {
    query += ' AND c.player_name LIKE ?';
    params.push(`%${filters.search}%`);
  }
  if (filters?.cardType) {
    query += ' AND c.card_type = ?';
    params.push(filters.cardType);
  }

  const sortMap: Record<string, string> = {
    price_asc: 'ml.price ASC',
    price_desc: 'ml.price DESC',
    rarity: `CASE c.rarity WHEN 'prismatic' THEN 7 WHEN 'holographic' THEN 6 WHEN 'diamond' THEN 5 WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END DESC`,
    name: 'c.player_name ASC',
  };
  query += ` ORDER BY ${sortMap[filters?.sort ?? ''] ?? 'ml.listed_at DESC'} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return database.prepare(query).all(...params) as ListingWithDetails[];
}

export function buyListing(listingId: number, buyerId: number): { success: boolean; error?: string; new_balance?: number; seller_id?: number; price?: number } {
  const database = getDb();
  let capturedSellerId: number | undefined;
  let capturedPrice: number | undefined;

  try {
    database.transaction(() => {
      const listing = database.prepare('SELECT * FROM marketplace_listings WHERE id = ? AND status = ?').get(listingId, 'active') as MarketplaceListing | undefined;
      if (!listing) throw new Error('Listing not found or already sold');
      capturedSellerId = listing.seller_id;
      capturedPrice = listing.price;

      if (listing.seller_id === buyerId) throw new Error('Cannot buy your own listing');

      const buyer = getUserById(buyerId);
      if (!buyer || buyer.coins < listing.price) throw new Error('Insufficient coins');

      // Transfer coins
      updateCoins(buyerId, -listing.price);
      updateCoins(listing.seller_id, listing.price);

      // Transfer card ownership
      database.prepare('UPDATE user_cards SET user_id = ?, source = ?, is_listed = 0, acquired_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(buyerId, 'marketplace', listing.user_card_id);

      // Update listing
      database.prepare('UPDATE marketplace_listings SET status = ?, buyer_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('sold', buyerId, listingId);

      // Record transactions
      const buyerAfter = getUserById(buyerId)!;
      const sellerAfter = getUserById(listing.seller_id)!;

      recordCoinTransaction(buyerId, -listing.price, buyerAfter.coins, 'marketplace_buy', `Purchased card from marketplace`, String(listingId));
      recordCoinTransaction(listing.seller_id, listing.price, sellerAfter.coins, 'marketplace_sale', `Sold card on marketplace`, String(listingId));
    })();

    const buyerAfter = getUserById(buyerId)!;
    return { success: true, new_balance: buyerAfter.coins, seller_id: capturedSellerId, price: capturedPrice };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function getActiveListingByUserCardId(userCardId: number): MarketplaceListing | undefined {
  return getDb().prepare('SELECT * FROM marketplace_listings WHERE user_card_id = ? AND status = ?').get(userCardId, 'active') as MarketplaceListing | undefined;
}

export function cancelListing(listingId: number, sellerId: number): boolean {
  const database = getDb();
  const listing = database.prepare('SELECT * FROM marketplace_listings WHERE id = ? AND seller_id = ? AND status = ?').get(listingId, sellerId, 'active') as MarketplaceListing | undefined;
  if (!listing) return false;
  
  database.prepare('UPDATE marketplace_listings SET status = ? WHERE id = ?').run('cancelled', listingId);
  database.prepare('UPDATE user_cards SET is_listed = 0 WHERE id = ?').run(listing.user_card_id);
  return true;
}

// ---- Coin transactions ----

export function recordCoinTransaction(userId: number, amount: number, balanceAfter: number, type: string, description: string, referenceId?: string) {
  getDb().prepare(`
    INSERT INTO coin_transactions (user_id, amount, balance_after, type, description, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, amount, balanceAfter, type, description, referenceId ?? null);
}

export const DAILY_BONUS_AMOUNT = 500;

// Streak milestones: day -> { coins, pack, guaranteed_rarity }
const STREAK_MILESTONES: Record<number, { coins: number; pack?: string; guaranteed_rarity?: string }> = {
  3:   { coins: 200 },
  7:   { coins: 0, guaranteed_rarity: 'diamond' },
  14:  { coins: 0, pack: 'elite' },
  30:  { coins: 1000, pack: 'apex' },
  100: { coins: 2000, pack: 'apex' },
};

export function claimDailyBonus(userId: number): {
  claimed: boolean; amount: number; newBalance: number;
  streak: number; streakBonus: { coins: number; pack?: string; guaranteed_rarity?: string } | null;
} {
  const database = getDb();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const user = getUserById(userId);
  if (!user) return { claimed: false, amount: 0, newBalance: 0, streak: 0, streakBonus: null };
  if (user.last_daily_bonus === today) {
    return { claimed: false, amount: 0, newBalance: user.coins, streak: user.login_streak ?? 0, streakBonus: null };
  }

  // Update streak: +1 if claimed yesterday, reset to 1 otherwise
  const newStreak = user.last_login_date === yesterday ? (user.login_streak ?? 0) + 1 : 1;

  database.prepare('UPDATE users SET coins = coins + ?, last_daily_bonus = ?, login_streak = ?, last_login_date = ? WHERE id = ?')
    .run(DAILY_BONUS_AMOUNT, today, newStreak, today, userId);
  const updated = getUserById(userId)!;
  recordCoinTransaction(userId, DAILY_BONUS_AMOUNT, updated.coins, 'daily_bonus', `Daily login bonus (${newStreak}-day streak)`);

  // Check streak milestone
  const streakBonus = STREAK_MILESTONES[newStreak] ?? null;
  if (streakBonus) {
    if (streakBonus.coins > 0) {
      database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(streakBonus.coins, userId);
      const afterBonus = getUserById(userId)!;
      recordCoinTransaction(userId, streakBonus.coins, afterBonus.coins, 'reward', `${newStreak}-day streak bonus`);
    }
    if (streakBonus.pack) {
      addToPackInventory(userId, streakBonus.pack);
    }
    if (streakBonus.guaranteed_rarity) {
      const rewardCard = database.prepare(
        `SELECT id FROM cards WHERE rarity = ? AND card_type = 'player' AND is_active = 1 ORDER BY RANDOM() LIMIT 1`
      ).get(streakBonus.guaranteed_rarity) as { id: string } | undefined;
      if (rewardCard) {
        database.prepare("INSERT INTO user_cards (user_id, card_id, source) VALUES (?, ?, 'reward')").run(userId, rewardCard.id);
      }
    }
  }

  const finalUser = getUserById(userId)!;
  return { claimed: true, amount: DAILY_BONUS_AMOUNT, newBalance: finalUser.coins, streak: newStreak, streakBonus };
}

// ---- Pack Inventory ----

export interface InventoryPack {
  id: number;
  pack_type: string;
  granted_at: string;
}

export function getPackInventory(userId: number): InventoryPack[] {
  return getDb().prepare(
    'SELECT id, pack_type, granted_at FROM pack_inventory WHERE user_id = ? ORDER BY granted_at ASC'
  ).all(userId) as InventoryPack[];
}

export function addToPackInventory(userId: number, packType: string): void {
  getDb().prepare('INSERT INTO pack_inventory (user_id, pack_type) VALUES (?, ?)').run(userId, packType);
}

/** Removes one inventory entry and returns its pack_type, or null if not found/not owned. */
export function consumeInventoryPack(userId: number, inventoryId: number): string | null {
  const db = getDb();
  let packType: string | null = null;
  db.transaction(() => {
    const row = db.prepare('SELECT id, pack_type FROM pack_inventory WHERE id = ? AND user_id = ?')
      .get(inventoryId, userId) as { id: number; pack_type: string } | undefined;
    if (!row) return;
    const deleted = db.prepare('DELETE FROM pack_inventory WHERE id = ? AND user_id = ?').run(inventoryId, userId);
    if (deleted.changes > 0) packType = row.pack_type;
  })();
  return packType;
}

const PRESTIGE_GRANT_CSA_ID = 420;
const DAILY_PRESTIGE_COUNT = 3;

/** Grants 3 daily Prestige packs to CSA ID 420. Returns true if packs were granted. */
export function grantDailyPrestigePacks(userId: number): boolean {
  const db = getDb();
  const user = db.prepare('SELECT csa_id, last_prestige_grant FROM users WHERE id = ?')
    .get(userId) as { csa_id: number | null; last_prestige_grant: string | null } | undefined;
  if (!user || user.csa_id !== PRESTIGE_GRANT_CSA_ID) return false;

  const today = new Date().toISOString().split('T')[0];
  if (user.last_prestige_grant === today) return false;

  const insert = db.prepare('INSERT INTO pack_inventory (user_id, pack_type) VALUES (?, ?)');
  db.transaction(() => {
    for (let i = 0; i < DAILY_PRESTIGE_COUNT; i++) insert.run(userId, 'elite');
    db.prepare('UPDATE users SET last_prestige_grant = ? WHERE id = ?').run(today, userId);
  })();
  return true;
}

export const SALVAGE_VALUES: Record<string, number> = {
  bronze: 6,
  silver: 10,
  gold: 15,
  platinum: 28,
  diamond: 60,
  holographic: 220,
  prismatic: 600,
};

export function salvageCard(userId: number, userCardId: number): { coins: number; newBalance: number } {
  const database = getDb();
  const row = database.prepare(`
    SELECT uc.id, uc.is_listed, uc.is_reward_card, c.rarity
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.id = ? AND uc.user_id = ?
  `).get(userCardId, userId) as { id: number; is_listed: number; is_reward_card: number; rarity: string } | undefined;

  if (!row) throw new Error('Card not found');
  if (row.is_listed) throw new Error('Cannot salvage a listed card');
  if (row.is_reward_card) throw new Error('Set reward cards cannot be salvaged');

  const coins = SALVAGE_VALUES[row.rarity] ?? 10;

  database.transaction(() => {
    database.prepare('DELETE FROM trade_cards WHERE user_card_id = ?').run(userCardId);
    database.prepare('DELETE FROM marketplace_listings WHERE user_card_id = ?').run(userCardId);
    database.prepare('DELETE FROM pack_cards WHERE user_card_id = ?').run(userCardId);
    database.prepare('DELETE FROM user_cards WHERE id = ?').run(userCardId);
    database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coins, userId);
  })();

  const updated = getUserById(userId)!;
  recordCoinTransaction(userId, coins, updated.coins, 'salvage', `Salvaged ${row.rarity} card`);
  return { coins, newBalance: updated.coins };
}

export function bulkSalvageCards(userId: number, userCardIds: number[]): { totalCoins: number; newBalance: number; count: number } {
  const database = getDb();
  let totalCoins = 0;
  let count = 0;

  database.transaction(() => {
    for (const userCardId of userCardIds) {
      const row = database.prepare(`
        SELECT uc.id, uc.is_listed, uc.is_reward_card, c.rarity
        FROM user_cards uc JOIN cards c ON uc.card_id = c.id
        WHERE uc.id = ? AND uc.user_id = ?
      `).get(userCardId, userId) as { id: number; is_listed: number; is_reward_card: number; rarity: string } | undefined;

      if (!row || row.is_listed || row.is_reward_card) continue;

      const coins = SALVAGE_VALUES[row.rarity] ?? 10;
      totalCoins += coins;
      count++;
      database.prepare('DELETE FROM trade_cards WHERE user_card_id = ?').run(userCardId);
      database.prepare('DELETE FROM marketplace_listings WHERE user_card_id = ?').run(userCardId);
      database.prepare('DELETE FROM pack_cards WHERE user_card_id = ?').run(userCardId);
      database.prepare('DELETE FROM user_cards WHERE id = ?').run(userCardId);
    }
    if (totalCoins > 0) {
      database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(totalCoins, userId);
    }
  })();

  const updated = getUserById(userId)!;
  if (totalCoins > 0) {
    recordCoinTransaction(userId, totalCoins, updated.coins, 'salvage', `Bulk salvaged ${count} cards`);
  }
  return { totalCoins, newBalance: updated.coins, count };
}

// ---- Collection stats ----

export function getTotalCardsAllUsers(): number {
  return (getDb().prepare('SELECT COUNT(*) as count FROM user_cards').get() as { count: number }).count;
}

export function getUserCollectionStats(userId: number) {
  const database = getDb();
  const total = (database.prepare('SELECT COUNT(*) as count FROM user_cards WHERE user_id = ?').get(userId) as { count: number }).count;
  const byRarity = database.prepare(`
    SELECT c.rarity, COUNT(*) as count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
    GROUP BY c.rarity
  `).all(userId) as { rarity: string; count: number }[];
  const uniquePlayers = (database.prepare(`
    SELECT COUNT(DISTINCT c.player_csa_id) as count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
  `).get(userId) as { count: number }).count;

  return { total, byRarity, uniquePlayers };
}

export function getExtendedUserStats(userId: number) {
  const db = getDb();

  const totalCards = (db.prepare('SELECT COUNT(*) as n FROM user_cards WHERE user_id = ?').get(userId) as { n: number }).n;
  const listedCards = (db.prepare("SELECT COUNT(*) as n FROM user_cards WHERE user_id = ? AND is_listed = 1").get(userId) as { n: number }).n;
  const uniquePlayers = (db.prepare(`SELECT COUNT(DISTINCT c.player_csa_id) as n FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = ?`).get(userId) as { n: number }).n;

  const byRarity = db.prepare(`
    SELECT c.rarity, COUNT(*) as count FROM user_cards uc
    JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = ?
    GROUP BY c.rarity ORDER BY count DESC
  `).all(userId) as { rarity: string; count: number }[];

  const byFranchise = db.prepare(`
    SELECT c.franchise_name, c.franchise_logo_url, c.franchise_color, COUNT(*) as count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? AND c.franchise_name IS NOT NULL
    GROUP BY c.franchise_name ORDER BY count DESC LIMIT 5
  `).all(userId) as { franchise_name: string; franchise_logo_url: string | null; franchise_color: string | null; count: number }[];

  const bestCard = db.prepare(`
    SELECT c.player_name, c.rarity, c.franchise_name, c.tier_name, c.player_avatar_url,
      (SELECT COUNT(*) FROM user_cards WHERE card_id = c.id) as copy_count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
    ORDER BY
      CASE c.rarity WHEN 'prismatic' THEN 7 WHEN 'holographic' THEN 6 WHEN 'diamond' THEN 5
        WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END DESC,
      copy_count ASC
    LIMIT 1
  `).get(userId) as { player_name: string; rarity: string; copy_count: number; franchise_name: string | null; tier_name: string | null; player_avatar_url: string | null } | undefined;

  const totalPacksOpened = (db.prepare('SELECT COUNT(*) as n FROM packs WHERE user_id = ?').get(userId) as { n: number }).n;

  const tradesCompleted = (db.prepare(`
    SELECT COUNT(*) as n FROM trades
    WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
  `).get(userId, userId) as { n: number }).n;

  const salesCompleted = (db.prepare(`
    SELECT COUNT(*) as n FROM marketplace_listings WHERE seller_id = ? AND status = 'sold'
  `).get(userId) as { n: number }).n;

  const purchasesCompleted = (db.prepare(`
    SELECT COUNT(*) as n FROM marketplace_listings WHERE buyer_id = ? AND status = 'sold'
  `).get(userId) as { n: number }).n;

  const bySource = db.prepare(`
    SELECT source, COUNT(*) as count FROM user_cards WHERE user_id = ? GROUP BY source
  `).all(userId) as { source: string; count: number }[];

  const recentCards = db.prepare(`
    SELECT c.player_name, c.rarity, c.franchise_name, c.player_avatar_url, uc.acquired_at, uc.source
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? ORDER BY uc.acquired_at DESC LIMIT 5
  `).all(userId) as { player_name: string; rarity: string; franchise_name: string | null; player_avatar_url: string | null; acquired_at: string; source: string }[];

  const byTier = db.prepare(`
    SELECT c.tier_name, COUNT(*) as count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? AND c.tier_name IS NOT NULL
    GROUP BY c.tier_name ORDER BY count DESC
  `).all(userId) as { tier_name: string; count: number }[];

  return { totalCards, listedCards, uniquePlayers, byRarity, byFranchise, bestCard, totalPacksOpened, tradesCompleted, salesCompleted, purchasesCompleted, bySource, recentCards, byTier };
}

// ---- Leaderboard ----

export function getCollectionLeaderboard(limit = 50): (User & { card_count: number })[] {
  return getDb().prepare(`
    SELECT u.*, COUNT(uc.id) as card_count
    FROM users u
    LEFT JOIN user_cards uc ON u.id = uc.user_id
    WHERE u.csa_id IS NOT NULL
    GROUP BY u.id
    ORDER BY card_count DESC
    LIMIT ?
  `).all(limit) as (User & { card_count: number })[];
}

// ---- Search users ----

export function searchUsers(query: string, limit = 20): User[] {
  const numeric = parseInt(query);
  if (!isNaN(numeric)) {
    return getDb().prepare(`SELECT * FROM users WHERE csa_id = ? LIMIT ?`).all(numeric, limit) as User[];
  }
  return getDb().prepare(`SELECT * FROM users WHERE (csa_name LIKE ? OR discord_username LIKE ?) LIMIT ?`).all(`%${query}%`, `%${query}%`, limit) as User[];
}

// ---- Admin operations ----

export function isAdmin(user: User): boolean {
  return user.is_admin === 1 || user.csa_id === SUPER_ADMIN_CSA_ID;
}

export function isSuperAdmin(user: User): boolean {
  return user.csa_id === SUPER_ADMIN_CSA_ID;
}

export function setAdminStatus(userId: number, isAdmin: boolean): void {
  getDb().prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, userId);
}

export function getSystemStats() {
  const db = getDb();
  const totalUsers = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  const totalCards = (db.prepare('SELECT COUNT(*) as n FROM user_cards').get() as { n: number }).n;
  const totalListings = (db.prepare("SELECT COUNT(*) as n FROM marketplace_listings WHERE status = 'active'").get() as { n: number }).n;
  const totalListingValue = (db.prepare("SELECT COALESCE(SUM(price),0) as n FROM marketplace_listings WHERE status = 'active'").get() as { n: number }).n;
  const totalTrades = (db.prepare("SELECT COUNT(*) as n FROM trades WHERE status = 'pending'").get() as { n: number }).n;
  const totalCoins = (db.prepare('SELECT COALESCE(SUM(coins),0) as n FROM users').get() as { n: number }).n;
  const cardsByRarity = db.prepare(`
    SELECT c.rarity, COUNT(*) as count FROM user_cards uc
    JOIN cards c ON uc.card_id = c.id GROUP BY c.rarity ORDER BY count DESC
  `).all() as { rarity: string; count: number }[];
  const admins = db.prepare('SELECT id, discord_username, csa_id, csa_name, avatar_url FROM users WHERE is_admin = 1').all() as Pick<User, 'id' | 'discord_username' | 'csa_id' | 'csa_name' | 'avatar_url'>[];
  return { totalUsers, totalCards, totalListings, totalListingValue, totalTrades, totalCoins, cardsByRarity, admins };
}

export function getAllUsers(search?: string, limit = 50): (User & { card_count: number })[] {
  if (search?.trim()) {
    const numeric = parseInt(search);
    if (!isNaN(numeric)) {
      return getDb().prepare(`
        SELECT u.*, COUNT(uc.id) as card_count FROM users u
        LEFT JOIN user_cards uc ON u.id = uc.user_id
        WHERE u.csa_id = ? GROUP BY u.id LIMIT ?
      `).all(numeric, limit) as (User & { card_count: number })[];
    }
    return getDb().prepare(`
      SELECT u.*, COUNT(uc.id) as card_count FROM users u
      LEFT JOIN user_cards uc ON u.id = uc.user_id
      WHERE u.csa_name LIKE ? OR u.discord_username LIKE ?
      GROUP BY u.id ORDER BY card_count DESC LIMIT ?
    `).all(`%${search}%`, `%${search}%`, limit) as (User & { card_count: number })[];
  }
  return getDb().prepare(`
    SELECT u.*, COUNT(uc.id) as card_count FROM users u
    LEFT JOIN user_cards uc ON u.id = uc.user_id
    GROUP BY u.id ORDER BY u.last_login DESC LIMIT ?
  `).all(limit) as (User & { card_count: number })[];
}

export function adminSetCoins(userId: number, amount: number): number {
  getDb().prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
  const updated = getUserById(userId)!;
  recordCoinTransaction(userId, amount, updated.coins, amount >= 0 ? 'admin_grant' : 'admin_deduct', `Admin: ${amount >= 0 ? 'added' : 'removed'} ${Math.abs(amount)} coins`);
  return updated.coins;
}

export function adminAddCoinsAll(amount: number): { count: number } {
  const database = getDb();
  const result = database.prepare('UPDATE users SET coins = coins + ?').run(amount);
  return { count: result.changes as number };
}

export function adminCancelListing(listingId: number): boolean {
  const db = getDb();
  const listing = db.prepare("SELECT * FROM marketplace_listings WHERE id = ? AND status = 'active'").get(listingId) as MarketplaceListing | undefined;
  if (!listing) return false;
  db.prepare("UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ?").run(listingId);
  db.prepare('UPDATE user_cards SET is_listed = 0 WHERE id = ?').run(listing.user_card_id);
  return true;
}

export function adminCancelTrade(tradeId: number): boolean {
  const db = getDb();
  const trade = db.prepare("SELECT * FROM trades WHERE id = ? AND status = 'pending'").get(tradeId);
  if (!trade) return false;
  db.prepare("UPDATE trades SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(tradeId);
  return true;
}

export function adminGetAllListings(limit = 100) {
  return getDb().prepare(`
    SELECT ml.*, c.player_name, c.rarity, c.franchise_name,
      u.discord_username as seller_name, u.csa_name as seller_csa_name
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    JOIN users u ON ml.seller_id = u.id
    WHERE ml.status = 'active'
    ORDER BY ml.listed_at DESC LIMIT ?
  `).all(limit);
}

export function adminGetAllTrades(limit = 100) {
  return getDb().prepare(`
    SELECT t.*,
      su.discord_username as sender_name, su.csa_name as sender_csa_name,
      ru.discord_username as receiver_name, ru.csa_name as receiver_csa_name
    FROM trades t
    JOIN users su ON t.sender_id = su.id
    JOIN users ru ON t.receiver_id = ru.id
    WHERE t.status = 'pending'
    ORDER BY t.created_at DESC LIMIT ?
  `).all(limit);
}

export function adminRemoveCard(userCardId: number): boolean {
  const db = getDb();
  const uc = db.prepare('SELECT * FROM user_cards WHERE id = ?').get(userCardId) as { is_listed: number } | undefined;
  if (!uc) return false;
  if (uc.is_listed) db.prepare("UPDATE marketplace_listings SET status = 'cancelled' WHERE user_card_id = ? AND status = 'active'").run(userCardId);
  db.prepare('DELETE FROM user_cards WHERE id = ?').run(userCardId);
  return true;
}

// ---- Trade interfaces ----

export interface Trade {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_coins: number;
  receiver_coins: number;
  status: string;
  created_at: string;
  resolved_at: string | null;
  expires_at: string | null;
}

export interface TradeWithDetails extends Trade {
  sender_name: string;
  sender_avatar: string | null;
  receiver_name: string;
  receiver_avatar: string | null;
  sender_cards: UserCardWithDetails[];
  receiver_cards: UserCardWithDetails[];
}

// ---- Trade operations ----

export function hasUserCard(userId: number, cardId: string): boolean {
  const row = getDb().prepare('SELECT id FROM user_cards WHERE user_id = ? AND card_id = ? LIMIT 1').get(userId, cardId);
  return row != null;
}

export function getUserPublicCards(userId: number): UserCardWithDetails[] {
  return getDb().prepare(`
    SELECT uc.id as user_card_id, uc.user_id, uc.card_id, uc.acquired_at, uc.source, uc.is_listed,
      c.id, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at
    FROM user_cards uc
    JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? AND uc.is_listed = 0
    ORDER BY c.overall_rating DESC
  `).all(userId) as UserCardWithDetails[];
}

function getTradeCards(tradeId: number, side: 'sender' | 'receiver'): UserCardWithDetails[] {
  return getDb().prepare(`
    SELECT uc.id as user_card_id, uc.user_id, uc.card_id, uc.acquired_at, uc.source, uc.is_listed,
      c.id, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at
    FROM trade_cards tc
    JOIN user_cards uc ON tc.user_card_id = uc.id
    JOIN cards c ON uc.card_id = c.id
    WHERE tc.trade_id = ? AND tc.side = ?
  `).all(tradeId, side) as UserCardWithDetails[];
}

export function getTradesForUser(userId: number): TradeWithDetails[] {
  const database = getDb();
  // Auto-expire trades past their expires_at
  database.exec(`UPDATE trades SET status = 'declined', resolved_at = CURRENT_TIMESTAMP WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP`);

  const trades = database.prepare(`
    SELECT t.*,
      COALESCE(su.csa_name, su.discord_username) as sender_name, su.avatar_url as sender_avatar,
      COALESCE(ru.csa_name, ru.discord_username) as receiver_name, ru.avatar_url as receiver_avatar
    FROM trades t
    JOIN users su ON t.sender_id = su.id
    JOIN users ru ON t.receiver_id = ru.id
    WHERE (t.sender_id = ? OR t.receiver_id = ?) AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `).all(userId, userId) as (Trade & { sender_name: string; sender_avatar: string | null; receiver_name: string; receiver_avatar: string | null })[];

  return trades.map(trade => ({
    ...trade,
    sender_cards: getTradeCards(trade.id, 'sender'),
    receiver_cards: getTradeCards(trade.id, 'receiver'),
  }));
}

export function createTrade(senderId: number, receiverId: number, senderCardIds: number[], receiverCardIds: number[], senderCoins = 0, receiverCoins = 0): number {
  const database = getDb();

  if (!senderCardIds.length && !senderCoins) throw new Error('Must offer at least one card or coins');
  if (!receiverCardIds.length && !receiverCoins) throw new Error('Must request at least one card or coins');

  const sender = database.prepare('SELECT coins FROM users WHERE id = ?').get(senderId) as { coins: number } | undefined;
  if (senderCoins > 0 && (!sender || sender.coins < senderCoins)) throw new Error('Not enough coins to offer');

  for (const id of senderCardIds) {
    const card = database.prepare('SELECT uc.*, c.player_name, c.rarity FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.id = ? AND uc.user_id = ?').get(id, senderId) as (UserCard & { player_name: string; rarity: string }) | undefined;
    if (!card) throw new Error(`Card not found in your collection (ID ${id})`);
    if (card.is_listed) throw new Error(`"${card.player_name}" (${card.rarity}) is listed on the marketplace and cannot be traded`);
    if (card.is_reward_card) throw new Error(`"${card.player_name}" (${card.rarity}) is a Set Reward card and cannot be traded`);
  }
  for (const id of receiverCardIds) {
    const card = database.prepare('SELECT uc.*, c.player_name, c.rarity FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.id = ? AND uc.user_id = ?').get(id, receiverId) as (UserCard & { player_name: string; rarity: string }) | undefined;
    if (!card) throw new Error(`Requested card not found in their collection (ID ${id})`);
    if (card.is_listed) throw new Error(`"${card.player_name}" (${card.rarity}) is listed on the marketplace and cannot be traded`);
    if (card.is_reward_card) throw new Error(`"${card.player_name}" (${card.rarity}) is a Set Reward card and cannot be traded`);
  }

  let tradeId: number;
  database.transaction(() => {
    const result = database.prepare(`INSERT INTO trades (sender_id, receiver_id, sender_coins, receiver_coins, status, expires_at) VALUES (?, ?, ?, ?, 'pending', datetime('now', '+7 days'))`).run(senderId, receiverId, senderCoins, receiverCoins);
    tradeId = result.lastInsertRowid as number;
    for (const id of senderCardIds) {
      database.prepare(`INSERT INTO trade_cards (trade_id, user_card_id, side) VALUES (?, ?, 'sender')`).run(tradeId, id);
    }
    for (const id of receiverCardIds) {
      database.prepare(`INSERT INTO trade_cards (trade_id, user_card_id, side) VALUES (?, ?, 'receiver')`).run(tradeId, id);
    }
  })();

  return tradeId!;
}

export function acceptTrade(tradeId: number, userId: number): { success: boolean; error?: string } {
  const database = getDb();

  try {
    database.transaction(() => {
      const trade = database.prepare(`SELECT * FROM trades WHERE id = ? AND receiver_id = ? AND status = 'pending'`).get(tradeId, userId) as Trade | undefined;
      if (!trade) throw new Error('Trade not found or you are not the receiver');

      const senderCards = getTradeCards(tradeId, 'sender');
      const receiverCards = getTradeCards(tradeId, 'receiver');

      for (const card of senderCards) {
        const current = database.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ? AND is_listed = 0').get(card.user_card_id, trade.sender_id);
        if (!current) throw new Error(`Sender no longer owns "${card.player_name}" (${card.rarity}) or it was listed on the marketplace`);
      }
      for (const card of receiverCards) {
        const current = database.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ? AND is_listed = 0').get(card.user_card_id, trade.receiver_id);
        if (!current) throw new Error(`You no longer own "${card.player_name}" (${card.rarity}) or it was listed on the marketplace`);
      }

      // Validate coin balances before transferring
      if (trade.sender_coins > 0) {
        const s = database.prepare('SELECT coins FROM users WHERE id = ?').get(trade.sender_id) as { coins: number };
        if (s.coins < trade.sender_coins) throw new Error('Sender no longer has enough coins');
      }
      if (trade.receiver_coins > 0) {
        const r = database.prepare('SELECT coins FROM users WHERE id = ?').get(trade.receiver_id) as { coins: number };
        if (r.coins < trade.receiver_coins) throw new Error('Receiver no longer has enough coins');
      }

      for (const card of senderCards) {
        database.prepare(`UPDATE user_cards SET user_id = ?, source = 'trade', acquired_at = CURRENT_TIMESTAMP WHERE id = ?`).run(trade.receiver_id, card.user_card_id);
      }
      for (const card of receiverCards) {
        database.prepare(`UPDATE user_cards SET user_id = ?, source = 'trade', acquired_at = CURRENT_TIMESTAMP WHERE id = ?`).run(trade.sender_id, card.user_card_id);
      }

      // Transfer coins
      if (trade.sender_coins > 0) {
        database.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(trade.sender_coins, trade.sender_id);
        database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(trade.sender_coins, trade.receiver_id);
      }
      if (trade.receiver_coins > 0) {
        database.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(trade.receiver_coins, trade.receiver_id);
        database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(trade.receiver_coins, trade.sender_id);
      }

      database.prepare(`UPDATE trades SET status = 'accepted', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tradeId);

      // Cancel other pending trades involving the same user_card ids
      const allCardIds = [...senderCards, ...receiverCards].map(c => c.user_card_id);
      if (allCardIds.length > 0) {
        const placeholders = allCardIds.map(() => '?').join(',');
        const affectedTradeIds = database.prepare(`
          SELECT DISTINCT trade_id FROM trade_cards WHERE user_card_id IN (${placeholders}) AND trade_id != ?
        `).all(...allCardIds, tradeId) as { trade_id: number }[];

        for (const { trade_id } of affectedTradeIds) {
          const t = database.prepare(`SELECT * FROM trades WHERE id = ? AND status = 'pending'`).get(trade_id);
          if (t) {
            database.prepare(`UPDATE trades SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(trade_id);
          }
        }
      }
    })();

    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export function declineTrade(tradeId: number, userId: number): boolean {
  const database = getDb();
  const trade = database.prepare(`SELECT * FROM trades WHERE id = ? AND receiver_id = ? AND status = 'pending'`).get(tradeId, userId);
  if (!trade) return false;
  database.prepare(`UPDATE trades SET status = 'declined', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tradeId);
  return true;
}

export function cancelTrade(tradeId: number, userId: number): boolean {
  const database = getDb();
  const trade = database.prepare(`SELECT * FROM trades WHERE id = ? AND sender_id = ? AND status = 'pending'`).get(tradeId, userId);
  if (!trade) return false;
  database.prepare(`UPDATE trades SET status = 'cancelled', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tradeId);
  return true;
}

// ---- Marketplace history ----

export interface MarketplaceHistoryItem {
  id: number;
  card_id: string;
  price: number;
  status: string;
  listed_at: string;
  sold_at: string | null;
  expires_at: string | null;
  role: 'seller' | 'buyer';
  other_user: string | null;
  other_avatar: string | null;
  player_name: string;
  rarity: string;
  franchise_name: string | null;
  player_avatar_url: string | null;
}

export function getMarketplaceHistory(userId: number, limit = 50): MarketplaceHistoryItem[] {
  return getDb().prepare(`
    SELECT ml.id, ml.card_id, ml.price, ml.status, ml.listed_at, ml.sold_at, ml.expires_at,
      CASE WHEN ml.seller_id = ? THEN 'seller' ELSE 'buyer' END as role,
      CASE WHEN ml.seller_id = ? THEN COALESCE(bu.csa_name, bu.discord_username) ELSE COALESCE(su.csa_name, su.discord_username) END as other_user,
      CASE WHEN ml.seller_id = ? THEN bu.avatar_url ELSE su.avatar_url END as other_avatar,
      c.player_name, c.rarity, c.franchise_name, c.player_avatar_url
    FROM marketplace_listings ml
    JOIN cards c ON ml.card_id = c.id
    JOIN users su ON ml.seller_id = su.id
    LEFT JOIN users bu ON ml.buyer_id = bu.id
    WHERE ml.seller_id = ? OR (ml.buyer_id = ? AND ml.status = 'sold')
    ORDER BY COALESCE(ml.sold_at, ml.listed_at) DESC
    LIMIT ?
  `).all(userId, userId, userId, userId, userId, limit) as MarketplaceHistoryItem[];
}

// ---- Bulk marketplace listing ----

export function bulkCreateListings(sellerId: number, items: { user_card_id: number; price: number }[]): { listed: number; skipped: number } {
  const db = getDb();
  let listed = 0;
  let skipped = 0;
  const MAX_PRICE = 1_000_000;

  db.transaction(() => {
    for (const { user_card_id, price } of items) {
      if (price < 1 || price > MAX_PRICE) { skipped++; continue; }
      const card = db.prepare('SELECT card_id, is_listed FROM user_cards WHERE id = ? AND user_id = ?').get(user_card_id, sellerId) as { card_id: string; is_listed: number } | undefined;
      if (!card || card.is_listed) { skipped++; continue; }
      db.prepare('UPDATE user_cards SET is_listed = 1 WHERE id = ?').run(user_card_id);
      db.prepare(`INSERT INTO marketplace_listings (seller_id, user_card_id, card_id, price, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+30 days'))`).run(sellerId, user_card_id, card.card_id, price);
      listed++;
    }
  })();

  return { listed, skipped };
}

// ---- Trade up ----

const RARITY_UPGRADE: Record<string, string> = {
  bronze: 'silver', silver: 'gold', gold: 'platinum',
  platinum: 'diamond', diamond: 'holographic', holographic: 'prismatic',
};

/** Validates + removes 5 cards for trade-up. Returns the rarity they were, or throws. */
export function consumeCardsForTradeUp(userId: number, userCardIds: number[]): string {
  if (userCardIds.length !== 5) throw new Error('Must select exactly 5 cards');
  const db = getDb();
  let commonRarity: string | null = null;

  db.transaction(() => {
    for (const id of userCardIds) {
      const row = db.prepare(`
        SELECT uc.id, uc.is_listed, c.rarity
        FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.id = ? AND uc.user_id = ?
      `).get(id, userId) as { id: number; is_listed: number; rarity: string } | undefined;

      if (!row) throw new Error('Card not found');
      if (row.is_listed) throw new Error('Cannot trade up a listed card');
      if (!commonRarity) commonRarity = row.rarity;
      else if (row.rarity !== commonRarity) throw new Error('All 5 cards must be the same rarity');
    }
    if (!RARITY_UPGRADE[commonRarity!]) throw new Error('Prismatic cards cannot be traded up');

    for (const id of userCardIds) {
      db.prepare('DELETE FROM trade_cards WHERE user_card_id = ?').run(id);
      db.prepare('DELETE FROM marketplace_listings WHERE user_card_id = ?').run(id);
      db.prepare('DELETE FROM pack_cards WHERE user_card_id = ?').run(id);
      db.prepare('DELETE FROM user_cards WHERE id = ?').run(id);
    }
  })();

  return commonRarity!;
}

// ---- Showcase cards ----

export interface ShowcaseCard {
  position: number;
  user_card_id: number;
  card_id: string;
  player_name: string;
  player_avatar_url: string | null;
  franchise_name: string | null;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_conf: string | null;
  tier_name: string | null;
  tier_abbr: string | null;
  rarity: string;
  card_type: string;
  stat_gpg: number;
  stat_apg: number;
  stat_svpg: number;
  stat_win_pct: number;
  salary: number;
  overall_rating: number;
  season_number: number;
}

export function getShowcaseCards(userId: number): ShowcaseCard[] {
  return getDb().prepare(`
    SELECT sc.position, sc.user_card_id,
      c.id as card_id, c.player_name, c.player_avatar_url, c.franchise_name, c.franchise_color,
      c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr, c.rarity, c.card_type,
      c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.season_number
    FROM showcase_cards sc
    JOIN user_cards uc ON sc.user_card_id = uc.id
    JOIN cards c ON uc.card_id = c.id
    WHERE sc.user_id = ?
    ORDER BY sc.position ASC
  `).all(userId) as ShowcaseCard[];
}

export function setShowcaseCard(userId: number, userCardId: number, position: number): void {
  if (position < 1 || position > 5) throw new Error('Position must be between 1 and 5');
  const db = getDb();
  const uc = db.prepare('SELECT id FROM user_cards WHERE id = ? AND user_id = ?').get(userCardId, userId);
  if (!uc) throw new Error('Card not found in your collection');
  db.prepare(`
    INSERT INTO showcase_cards (user_id, user_card_id, position) VALUES (?, ?, ?)
    ON CONFLICT(user_id, position) DO UPDATE SET user_card_id = excluded.user_card_id, added_at = CURRENT_TIMESTAMP
  `).run(userId, userCardId, position);
}

export function removeShowcaseCard(userId: number, position: number): void {
  getDb().prepare('DELETE FROM showcase_cards WHERE user_id = ? AND position = ?').run(userId, position);
}

export function getPublicUserProfile(userId: number): {
  user: Pick<User, 'id' | 'discord_username' | 'csa_id' | 'csa_name' | 'avatar_url' | 'created_at' | 'coins'>;
  showcase: ShowcaseCard[];
  stats: { totalCards: number; uniquePlayers: number; totalPacksOpened: number; tradesCompleted: number };
  collection_value: number;
  net_worth: number;
} | null {
  const db = getDb();
  const user = db.prepare('SELECT id, discord_username, csa_id, csa_name, avatar_url, created_at, coins FROM users WHERE id = ?').get(userId) as Pick<User, 'id' | 'discord_username' | 'csa_id' | 'csa_name' | 'avatar_url' | 'created_at' | 'coins'> | undefined;
  if (!user) return null;
  const showcase = getShowcaseCards(userId);
  const totalCards = (db.prepare('SELECT COUNT(*) as n FROM user_cards WHERE user_id = ?').get(userId) as { n: number }).n;
  const uniquePlayers = (db.prepare(`SELECT COUNT(DISTINCT c.player_csa_id) as n FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = ?`).get(userId) as { n: number }).n;
  const totalPacksOpened = (db.prepare('SELECT COUNT(*) as n FROM packs WHERE user_id = ?').get(userId) as { n: number }).n;
  const tradesCompleted = (db.prepare(`SELECT COUNT(*) as n FROM trades WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'`).get(userId, userId) as { n: number }).n;
  const collection_value = getUserCollectionValue(userId);
  return { user, showcase, stats: { totalCards, uniquePlayers, totalPacksOpened, tradesCompleted }, collection_value, net_worth: user.coins + collection_value };
}

// ---- Card valuation ----

export const BASE_CARD_VALUES: Record<string, number> = {
  bronze: 40,
  silver: 80,
  gold: 200,
  platinum: 500,
  diamond: 1500,
  holographic: 6000,
  prismatic: 25000,
};

export function estimateCardValue(cardId: string): {
  value: number;
  basis: 'sales' | 'rarity_market' | 'base';
  copy_count: number;
  recent_sales_count: number;
  recent_avg: number | null;
} {
  const db = getDb();
  const card = db.prepare('SELECT rarity FROM cards WHERE id = ?').get(cardId) as { rarity: string } | undefined;
  if (!card) return { value: 0, basis: 'base', copy_count: 0, recent_sales_count: 0, recent_avg: null };

  const salvage = SALVAGE_VALUES[card.rarity] ?? 6;
  const base = BASE_CARD_VALUES[card.rarity] ?? 40;
  const copyCount = (db.prepare('SELECT COUNT(*) as n FROM user_cards WHERE card_id = ?').get(cardId) as { n: number }).n;

  const cardSalesRow = db.prepare(`
    SELECT AVG(price) as avg_price, COUNT(*) as cnt
    FROM (SELECT price FROM marketplace_listings WHERE card_id = ? AND status = 'sold' ORDER BY sold_at DESC LIMIT 5)
  `).get(cardId) as { avg_price: number | null; cnt: number };

  const raritySalesRow = db.prepare(`
    SELECT AVG(sub.price) as avg_price
    FROM (
      SELECT ml.price FROM marketplace_listings ml
      JOIN cards c ON ml.card_id = c.id
      WHERE c.rarity = ? AND ml.status = 'sold'
      ORDER BY ml.sold_at DESC LIMIT 30
    ) sub
  `).get(card.rarity) as { avg_price: number | null };

  const cardAvg = cardSalesRow.avg_price;
  const cardCnt = cardSalesRow.cnt;
  const rarityAvg = raritySalesRow.avg_price;

  let marketEst: number;
  let basis: 'sales' | 'rarity_market' | 'base';

  if (cardCnt >= 3 && cardAvg) {
    marketEst = cardAvg;
    basis = 'sales';
  } else if (cardCnt >= 1 && cardAvg) {
    marketEst = cardAvg * 0.65 + (rarityAvg ?? base) * 0.35;
    basis = 'sales';
  } else if (rarityAvg) {
    marketEst = rarityAvg * 0.45 + base * 0.55;
    basis = 'rarity_market';
  } else {
    marketEst = base;
    basis = 'base';
  }

  const scarcity = copyCount <= 1 ? 2.5 : copyCount <= 2 ? 2.0 : copyCount <= 5 ? 1.5 : copyCount <= 10 ? 1.3 : copyCount <= 20 ? 1.15 : copyCount <= 50 ? 1.05 : 1.0;
  const value = Math.round(Math.max(salvage, marketEst) * scarcity);

  return { value, basis, copy_count: copyCount, recent_sales_count: cardCnt, recent_avg: cardAvg ? Math.round(cardAvg) : null };
}

export function getUserCollectionValue(userId: number): number {
  const db = getDb();

  const cards = db.prepare(`
    SELECT uc.card_id, c.rarity,
      (SELECT COUNT(*) FROM user_cards uc2 WHERE uc2.card_id = uc.card_id) as copy_count
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ?
  `).all(userId) as { card_id: string; rarity: string; copy_count: number }[];

  if (cards.length === 0) return 0;

  const rarityAvgs = db.prepare(`
    SELECT sub.rarity, AVG(sub.price) as avg_price
    FROM (
      SELECT c.rarity, ml.price
      FROM marketplace_listings ml JOIN cards c ON ml.card_id = c.id
      WHERE ml.status = 'sold'
      ORDER BY ml.sold_at DESC LIMIT 350
    ) sub
    GROUP BY sub.rarity
  `).all() as { rarity: string; avg_price: number }[];
  const rarityAvgMap = new Map(rarityAvgs.map(r => [r.rarity, r.avg_price]));

  const uniqueCardIds = [...new Set(cards.map(c => c.card_id))];
  const cardAvgMap = new Map<string, number>();
  for (const cardId of uniqueCardIds) {
    const row = db.prepare(`
      SELECT AVG(price) as avg_price, COUNT(*) as cnt
      FROM (SELECT price FROM marketplace_listings WHERE card_id = ? AND status = 'sold' ORDER BY sold_at DESC LIMIT 5)
    `).get(cardId) as { avg_price: number | null; cnt: number };
    if (row.cnt > 0 && row.avg_price) cardAvgMap.set(cardId, row.avg_price);
  }

  let total = 0;
  for (const { card_id, rarity, copy_count } of cards) {
    const salvage = SALVAGE_VALUES[rarity] ?? 6;
    const base = BASE_CARD_VALUES[rarity] ?? 40;
    const cardAvg = cardAvgMap.get(card_id);
    const rarityAvg = rarityAvgMap.get(rarity);

    let marketEst: number;
    if (cardAvg) {
      marketEst = cardAvg;
    } else if (rarityAvg) {
      marketEst = rarityAvg * 0.45 + base * 0.55;
    } else {
      marketEst = base;
    }

    const scarcity = copy_count <= 1 ? 2.5 : copy_count <= 2 ? 2.0 : copy_count <= 5 ? 1.5 : copy_count <= 10 ? 1.3 : copy_count <= 20 ? 1.15 : copy_count <= 50 ? 1.05 : 1.0;
    total += Math.round(Math.max(salvage, marketEst) * scarcity);
  }

  return total;
}

export interface LeaderboardEntry {
  id: number;
  display_name: string;
  avatar_url: string | null;
  csa_id: number | null;
  coins: number;
  card_count: number;
  collection_value: number;
  net_worth: number;
}

export function getLeaderboard(limit = 100): LeaderboardEntry[] {
  return getDb().prepare(`
    WITH card_copy_counts AS (
      SELECT card_id, COUNT(*) as copies
      FROM user_cards
      GROUP BY card_id
    )
    SELECT
      u.id,
      COALESCE(u.csa_name, u.discord_username) as display_name,
      u.avatar_url,
      u.csa_id,
      u.coins,
      COUNT(uc.id) as card_count,
      CAST(COALESCE(SUM(
        CASE c.rarity
          WHEN 'prismatic' THEN 25000
          WHEN 'holographic' THEN 6000
          WHEN 'diamond' THEN 1500
          WHEN 'platinum' THEN 500
          WHEN 'gold' THEN 200
          WHEN 'silver' THEN 80
          ELSE 40
        END * MIN(2.5, MAX(1.0, 5.0 / MAX(1.0, CAST(ccc.copies AS REAL))))
      ), 0) AS INTEGER) as collection_value,
      CAST(u.coins + COALESCE(SUM(
        CASE c.rarity
          WHEN 'prismatic' THEN 25000
          WHEN 'holographic' THEN 6000
          WHEN 'diamond' THEN 1500
          WHEN 'platinum' THEN 500
          WHEN 'gold' THEN 200
          WHEN 'silver' THEN 80
          ELSE 40
        END * MIN(2.5, MAX(1.0, 5.0 / MAX(1.0, CAST(ccc.copies AS REAL))))
      ), 0) AS INTEGER) as net_worth
    FROM users u
    LEFT JOIN user_cards uc ON u.id = uc.user_id
    LEFT JOIN cards c ON uc.card_id = c.id
    LEFT JOIN card_copy_counts ccc ON uc.card_id = ccc.card_id
    GROUP BY u.id
    ORDER BY net_worth DESC
    LIMIT ?
  `).all(limit) as LeaderboardEntry[];
}

// ---- Featured cards config ----

export type FeaturedCardWithData = Pick<Card,
  'id' | 'player_name' | 'player_avatar_url' | 'franchise_name' | 'franchise_abbr' |
  'franchise_logo_url' | 'franchise_color' | 'franchise_conf' | 'tier_name' | 'tier_abbr' |
  'rarity' | 'card_type' | 'stat_gpg' | 'stat_apg' | 'stat_svpg' | 'stat_win_pct' |
  'salary' | 'overall_rating' | 'season_number'
> & { position: number };

export function getFeaturedCardsWithData(): FeaturedCardWithData[] {
  return getDb().prepare(`
    SELECT fc.position,
      c.id, c.player_name, c.player_avatar_url, c.franchise_name, c.franchise_abbr,
      c.franchise_logo_url, c.franchise_color, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct,
      c.salary, c.overall_rating, c.season_number
    FROM featured_cards fc
    JOIN cards c ON fc.card_id = c.id
    ORDER BY fc.position
  `).all() as FeaturedCardWithData[];
}

export function setFeaturedCard(position: number, cardId: string): void {
  getDb().prepare(
    'INSERT INTO featured_cards (position, card_id) VALUES (?, ?) ON CONFLICT(position) DO UPDATE SET card_id = excluded.card_id'
  ).run(position, cardId);
}

export function clearFeaturedSlot(position: number): void {
  getDb().prepare('DELETE FROM featured_cards WHERE position = ?').run(position);
}

export function searchCardsForAdmin(query: string, limit = 20): Pick<Card,
  'id' | 'player_name' | 'player_avatar_url' | 'franchise_name' | 'franchise_abbr' |
  'franchise_logo_url' | 'franchise_color' | 'franchise_conf' | 'tier_name' | 'tier_abbr' |
  'rarity' | 'card_type' | 'stat_gpg' | 'stat_apg' | 'stat_svpg' | 'stat_win_pct' |
  'salary' | 'overall_rating' | 'season_number'
>[] {
  return getDb().prepare(`
    SELECT id, player_name, player_avatar_url, franchise_name, franchise_abbr,
      franchise_logo_url, franchise_color, franchise_conf, tier_name, tier_abbr,
      rarity, card_type, stat_gpg, stat_apg, stat_svpg, stat_win_pct,
      salary, overall_rating, season_number
    FROM cards
    WHERE player_name LIKE ?
    ORDER BY
      CASE rarity WHEN 'prismatic' THEN 7 WHEN 'holographic' THEN 6 WHEN 'diamond' THEN 5
        WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END DESC,
      player_name
    LIMIT ?
  `).all(`%${query}%`, limit) as any[];
}

// ---- Full Set Rewards (Franchise-based) ----

const ALL_RARITIES = ['bronze','silver','gold','platinum','diamond','holographic','prismatic'];

export interface FranchiseSetStatus {
  franchise_id: number;
  franchise_name: string;
  franchise_color: string | null;
  franchise_logo_url: string | null;
  franchise_abbr: string | null;
  franchise_conf: string | null;
  season_id: number;
  season_number: number;
  set_type: 'rarity' | 'super';
  rarity: string | null;
  owned_count: number;
  total_count: number;
  is_complete: boolean;
  already_claimed: boolean;
}

function getOrCreateSetRewardCard(
  db: Database.Database,
  setType: 'rarity' | 'super',
  franchiseId: number,
  franchiseName: string,
  franchiseColor: string | null,
  franchiseLogoUrl: string | null,
  franchiseAbbr: string | null,
  franchiseConf: string | null,
  rarity: string,
  seasonId: number,
  seasonNumber: number,
): string {
  const cardId = `set_reward:${setType}:${franchiseId}:${rarity}:${seasonId}`;
  db.prepare(`
    INSERT OR IGNORE INTO cards (
      id, player_csa_id, player_name, player_discord_id, player_avatar_url,
      season_id, season_number, franchise_id, franchise_name, franchise_abbr,
      franchise_color, franchise_logo_url, franchise_conf, tier_name, tier_abbr,
      rarity, card_type, stat_gpg, stat_apg, stat_svpg, stat_win_pct, salary, overall_rating
    ) VALUES (?, 0, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'Set Reward', 'SR', ?, 'set_reward', 0, 0, 0, 0, 0, 0)
  `).run(
    cardId,
    setType === 'super'
      ? `${franchiseName} Super Set Reward`
      : `${franchiseName} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Set Reward`,
    seasonId, seasonNumber,
    franchiseId, franchiseName, franchiseAbbr, franchiseColor, franchiseLogoUrl, franchiseConf,
    rarity,
  );
  return cardId;
}

export function getSetStatuses(userId: number): FranchiseSetStatus[] {
  const db = getDb();

  // Get all distinct franchise+season combos the user has player cards for
  const franchises = db.prepare(`
    SELECT DISTINCT c.franchise_id, c.franchise_name, c.franchise_color, c.franchise_logo_url,
      c.franchise_abbr, c.franchise_conf, c.season_id, c.season_number
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? AND c.card_type = 'player' AND c.franchise_id IS NOT NULL
  `).all(userId) as { franchise_id: number; franchise_name: string; franchise_color: string | null; franchise_logo_url: string | null; franchise_abbr: string | null; franchise_conf: string | null; season_id: number; season_number: number }[];

  const results: FranchiseSetStatus[] = [];

  for (const f of franchises) {
    // --- Rarity sets (one per rarity) ---
    for (const rarity of ALL_RARITIES) {
      const totalRow = db.prepare(`
        SELECT COUNT(DISTINCT player_csa_id) as cnt
        FROM cards WHERE franchise_id = ? AND season_id = ? AND rarity = ? AND card_type = 'player' AND is_active = 1
      `).get(f.franchise_id, f.season_id, rarity) as { cnt: number };
      const total = totalRow.cnt;
      if (total === 0) continue;

      const ownedRow = db.prepare(`
        SELECT COUNT(DISTINCT c.player_csa_id) as cnt
        FROM user_cards uc JOIN cards c ON uc.card_id = c.id
        WHERE uc.user_id = ? AND c.franchise_id = ? AND c.season_id = ? AND c.rarity = ? AND c.card_type = 'player'
      `).get(userId, f.franchise_id, f.season_id, rarity) as { cnt: number };
      const owned = ownedRow.cnt;

      const claimed = db.prepare(
        `SELECT id FROM franchise_set_rewards WHERE user_id = ? AND set_type = 'rarity' AND franchise_id = ? AND rarity = ? AND season_id = ?`
      ).get(userId, f.franchise_id, rarity, f.season_id);

      results.push({
        ...f,
        set_type: 'rarity',
        rarity,
        owned_count: owned,
        total_count: total,
        is_complete: owned >= total,
        already_claimed: !!claimed,
      });
    }

    // --- Super set (all players × all rarities) ---
    const totalSuperRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM (
        SELECT DISTINCT player_csa_id, rarity FROM cards
        WHERE franchise_id = ? AND season_id = ? AND card_type = 'player' AND is_active = 1
      )
    `).get(f.franchise_id, f.season_id) as { cnt: number };
    const totalSuper = totalSuperRow.cnt;
    if (totalSuper === 0) continue;

    const ownedSuperRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM (
        SELECT DISTINCT c.player_csa_id, c.rarity
        FROM user_cards uc JOIN cards c ON uc.card_id = c.id
        WHERE uc.user_id = ? AND c.franchise_id = ? AND c.season_id = ? AND c.card_type = 'player'
      )
    `).get(userId, f.franchise_id, f.season_id) as { cnt: number };
    const ownedSuper = ownedSuperRow.cnt;

    const claimedSuper = db.prepare(
      `SELECT id FROM franchise_set_rewards WHERE user_id = ? AND set_type = 'super' AND franchise_id = ? AND season_id = ?`
    ).get(userId, f.franchise_id, f.season_id);

    results.push({
      ...f,
      set_type: 'super',
      rarity: null,
      owned_count: ownedSuper,
      total_count: totalSuper,
      is_complete: ownedSuper >= totalSuper,
      already_claimed: !!claimedSuper,
    });
  }

  return results;
}

export function claimSetReward(userId: number, setType: 'rarity' | 'super', franchiseId: number, rarity: string | null, seasonId: number): { card_id: string; card_name: string } {
  const db = getDb();

  const alreadyClaimed = setType === 'rarity'
    ? db.prepare(`SELECT id FROM franchise_set_rewards WHERE user_id = ? AND set_type = 'rarity' AND franchise_id = ? AND rarity = ? AND season_id = ?`).get(userId, franchiseId, rarity, seasonId)
    : db.prepare(`SELECT id FROM franchise_set_rewards WHERE user_id = ? AND set_type = 'super' AND franchise_id = ? AND season_id = ?`).get(userId, franchiseId, seasonId);
  if (alreadyClaimed) throw new Error('Reward already claimed for this set');

  // Verify set is complete
  if (setType === 'rarity') {
    if (!rarity) throw new Error('Rarity required for rarity set claim');
    const total = (db.prepare(`SELECT COUNT(DISTINCT player_csa_id) as cnt FROM cards WHERE franchise_id = ? AND season_id = ? AND rarity = ? AND card_type = 'player' AND is_active = 1`).get(franchiseId, seasonId, rarity) as { cnt: number }).cnt;
    const owned = (db.prepare(`SELECT COUNT(DISTINCT c.player_csa_id) as cnt FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = ? AND c.franchise_id = ? AND c.season_id = ? AND c.rarity = ? AND c.card_type = 'player'`).get(userId, franchiseId, seasonId, rarity) as { cnt: number }).cnt;
    if (owned < total || total === 0) throw new Error('Set is not yet complete');
  } else {
    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM (SELECT DISTINCT player_csa_id, rarity FROM cards WHERE franchise_id = ? AND season_id = ? AND card_type = 'player' AND is_active = 1)`).get(franchiseId, seasonId) as { cnt: number }).cnt;
    const owned = (db.prepare(`SELECT COUNT(*) as cnt FROM (SELECT DISTINCT c.player_csa_id, c.rarity FROM user_cards uc JOIN cards c ON uc.card_id = c.id WHERE uc.user_id = ? AND c.franchise_id = ? AND c.season_id = ? AND c.card_type = 'player')`).get(userId, franchiseId, seasonId) as { cnt: number }).cnt;
    if (owned < total || total === 0) throw new Error('Super set is not yet complete');
  }

  // Get franchise info for reward card
  const franchiseInfo = db.prepare(`SELECT franchise_name, franchise_color, franchise_logo_url, franchise_abbr, franchise_conf, season_number FROM cards WHERE franchise_id = ? AND season_id = ? LIMIT 1`).get(franchiseId, seasonId) as { franchise_name: string; franchise_color: string | null; franchise_logo_url: string | null; franchise_abbr: string | null; franchise_conf: string | null; season_number: number } | undefined;
  if (!franchiseInfo) throw new Error('Franchise not found');

  const rewardRarity = setType === 'super' ? 'prismatic' : rarity!;
  const cardId = getOrCreateSetRewardCard(db, setType, franchiseId, franchiseInfo.franchise_name, franchiseInfo.franchise_color, franchiseInfo.franchise_logo_url, franchiseInfo.franchise_abbr, franchiseInfo.franchise_conf, rewardRarity, seasonId, franchiseInfo.season_number);
  const cardName = setType === 'super'
    ? `${franchiseInfo.franchise_name} Super Set Reward`
    : `${franchiseInfo.franchise_name} ${rewardRarity.charAt(0).toUpperCase() + rewardRarity.slice(1)} Set Reward`;

  db.transaction(() => {
    db.prepare("INSERT INTO user_cards (user_id, card_id, source, is_reward_card) VALUES (?, ?, 'reward', 1)").run(userId, cardId);
    db.prepare(`INSERT INTO franchise_set_rewards (user_id, set_type, franchise_id, rarity, season_id, reward_card_id) VALUES (?, ?, ?, ?, ?, ?)`).run(userId, setType, franchiseId, rarity ?? null, seasonId, cardId);
  })();

  return { card_id: cardId, card_name: cardName };
}

// ---- Challenges ----

export interface Challenge {
  id: number;
  type: string;
  key: string;
  title: string;
  description: string;
  reward_coins: number;
  reward_pack_type: string | null;
  target: number;
}

export interface UserChallengeProgress {
  id: number;
  challenge_id: number;
  period_key: string;
  progress: number;
  completed: number;
  claimed: number;
  completed_at: string | null;
  claimed_at: string | null;
}

export type ChallengeWithProgress = Challenge & { progress: number; completed: boolean; claimed: boolean; period_key: string };

function getDailyPeriodKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeeklyPeriodKey(): string {
  const d = new Date();
  const startOfYear = new Date(d.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function seedChallenges(): void {
  const db = getDb();
  const defaults: Omit<Challenge, 'id'>[] = [
    { type: 'daily', key: 'daily_open_pack', title: 'Pack Opener', description: 'Open 1 pack today', reward_coins: 50, reward_pack_type: null, target: 1 },
    { type: 'daily', key: 'daily_open_3_packs', title: 'Triple Pack', description: 'Open 3 packs today', reward_coins: 150, reward_pack_type: null, target: 3 },
    { type: 'daily', key: 'daily_list_card', title: 'Merchant', description: 'List 1 card on the marketplace', reward_coins: 30, reward_pack_type: null, target: 1 },
    { type: 'daily', key: 'daily_salvage_5', title: 'Recycler', description: 'Salvage 5 cards', reward_coins: 75, reward_pack_type: null, target: 5 },
    { type: 'weekly', key: 'weekly_open_10_packs', title: 'Pack Addict', description: 'Open 10 packs this week', reward_coins: 400, reward_pack_type: null, target: 10 },
    { type: 'weekly', key: 'weekly_complete_trade', title: 'Trader', description: 'Complete 1 trade this week', reward_coins: 300, reward_pack_type: null, target: 1 },
    { type: 'weekly', key: 'weekly_earn_1000_market', title: 'Hustler', description: 'Earn 1000+ coins from marketplace sales', reward_coins: 500, reward_pack_type: null, target: 1000 },
    { type: 'weekly', key: 'weekly_open_elite_pack', title: 'Elite Status', description: 'Open 1 Prestige pack', reward_coins: 200, reward_pack_type: 'standard', target: 1 },
  ];
  for (const c of defaults) {
    db.prepare(`INSERT OR IGNORE INTO challenges (type, key, title, description, reward_coins, reward_pack_type, target) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c.type, c.key, c.title, c.description, c.reward_coins, c.reward_pack_type, c.target);
  }
}

export function getChallengesForUser(userId: number): ChallengeWithProgress[] {
  seedChallenges();
  const db = getDb();
  const dailyKey = getDailyPeriodKey();
  const weeklyKey = getWeeklyPeriodKey();

  const challenges = db.prepare('SELECT * FROM challenges').all() as Challenge[];
  return challenges.map(c => {
    const periodKey = c.type === 'daily' ? dailyKey : weeklyKey;
    const progress = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND period_key = ?').get(userId, c.id, periodKey) as UserChallengeProgress | undefined;
    return {
      ...c,
      period_key: periodKey,
      progress: progress?.progress ?? 0,
      completed: !!(progress?.completed),
      claimed: !!(progress?.claimed),
    };
  });
}

export function incrementChallengeProgress(userId: number, challengeKey: string, amount = 1): void {
  const db = getDb();
  const challenge = db.prepare("SELECT * FROM challenges WHERE key = ?").get(challengeKey) as Challenge | undefined;
  if (!challenge) return;

  const periodKey = challenge.type === 'daily' ? getDailyPeriodKey() : getWeeklyPeriodKey();

  db.prepare(`
    INSERT INTO user_challenges (user_id, challenge_id, period_key, progress, completed)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(user_id, challenge_id, period_key) DO UPDATE SET
      progress = MIN(user_challenges.progress + ?, challenges.target),
      completed = CASE WHEN user_challenges.progress + ? >= challenges.target THEN 1 ELSE user_challenges.completed END,
      completed_at = CASE WHEN user_challenges.completed = 0 AND user_challenges.progress + ? >= challenges.target THEN CURRENT_TIMESTAMP ELSE user_challenges.completed_at END
  `).run(userId, challenge.id, periodKey, Math.min(amount, challenge.target), amount, amount, amount);
}

export function claimChallengeReward(userId: number, challengeId: number, periodKey: string): { coins: number; pack?: string; newBalance: number } {
  const db = getDb();
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId) as Challenge | undefined;
  if (!challenge) throw new Error('Challenge not found');

  const progress = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND period_key = ?').get(userId, challengeId, periodKey) as UserChallengeProgress | undefined;
  if (!progress?.completed) throw new Error('Challenge not completed');
  if (progress.claimed) throw new Error('Reward already claimed');

  db.transaction(() => {
    db.prepare('UPDATE user_challenges SET claimed = 1, claimed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND challenge_id = ? AND period_key = ?').run(userId, challengeId, periodKey);
    if (challenge.reward_coins > 0) {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(challenge.reward_coins, userId);
    }
    if (challenge.reward_pack_type) {
      db.prepare('INSERT INTO pack_inventory (user_id, pack_type) VALUES (?, ?)').run(userId, challenge.reward_pack_type);
    }
  })();

  const updated = getUserById(userId)!;
  if (challenge.reward_coins > 0) {
    recordCoinTransaction(userId, challenge.reward_coins, updated.coins, 'reward', `Challenge reward: ${challenge.title}`);
  }
  return { coins: challenge.reward_coins, pack: challenge.reward_pack_type ?? undefined, newBalance: updated.coins };
}

// ---- Rotating Shop ----

export interface ShopSlot {
  id: number;
  slot_key: string;
  item_type: string;
  pack_type: string | null;
  coin_amount: number | null;
  price: number;
  rotation_starts: string;
  rotation_ends: string;
  stock: number | null;
  sold_count: number;
}

export function getActiveShopSlots(): ShopSlot[] {
  return getDb().prepare(`
    SELECT * FROM shop_slots
    WHERE rotation_starts <= CURRENT_TIMESTAMP AND rotation_ends > CURRENT_TIMESTAMP
    ORDER BY slot_key
  `).all() as ShopSlot[];
}

export function seedShopRotation(): void {
  const db = getDb();

  // Check if there are any active slots; if not, generate new ones
  const active = db.prepare(`SELECT COUNT(*) as n FROM shop_slots WHERE rotation_ends > CURRENT_TIMESTAMP`).get() as { n: number };
  if (active.n > 0) return;

  // Daily rotation: resets every day at UTC midnight
  // Weekly rotation: resets every Monday at UTC midnight
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  // Get next Monday
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
  const nextMonday = new Date(todayStart.getTime() + daysUntilMonday * 86400000);

  const dailyItems = [
    { slot_key: 'daily_1', item_type: 'pack', pack_type: 'standard', price: 150 },
    { slot_key: 'daily_2', item_type: 'pack', pack_type: 'elite', price: 220 },
    { slot_key: 'daily_3', item_type: 'coins', coin_amount: 500, price: 400 },
  ];
  const weeklyItems = [
    { slot_key: 'weekly_1', item_type: 'pack', pack_type: 'apex', price: 1200 },
    { slot_key: 'weekly_2', item_type: 'pack', pack_type: 'elite', price: 180, stock: 5 },
    { slot_key: 'weekly_3', item_type: 'coins', coin_amount: 2000, price: 1500, stock: 3 },
  ];

  const insertSlot = db.prepare(`INSERT INTO shop_slots (slot_key, item_type, pack_type, coin_amount, price, rotation_starts, rotation_ends, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  db.transaction(() => {
    for (const item of dailyItems) {
      insertSlot.run(item.slot_key, item.item_type, (item as { pack_type?: string }).pack_type ?? null, (item as { coin_amount?: number }).coin_amount ?? null, item.price, todayStart.toISOString(), tomorrowStart.toISOString(), null);
    }
    for (const item of weeklyItems) {
      insertSlot.run(item.slot_key, item.item_type, (item as { pack_type?: string }).pack_type ?? null, (item as { coin_amount?: number }).coin_amount ?? null, item.price, todayStart.toISOString(), nextMonday.toISOString(), (item as { stock?: number }).stock ?? null);
    }
  })();
}

export function purchaseShopSlot(userId: number, slotId: number): { item_type: string; pack_type?: string; coin_amount?: number; newBalance: number } {
  const db = getDb();

  const slot = db.prepare(`SELECT * FROM shop_slots WHERE id = ? AND rotation_starts <= CURRENT_TIMESTAMP AND rotation_ends > CURRENT_TIMESTAMP`).get(slotId) as ShopSlot | undefined;
  if (!slot) throw new Error('Shop item not available');
  if (slot.stock !== null && slot.sold_count >= slot.stock) throw new Error('This item is sold out');

  const user = getUserById(userId);
  if (!user) throw new Error('User not found');
  if (user.coins < slot.price) throw new Error('Not enough coins');

  db.transaction(() => {
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(slot.price, userId);
    db.prepare('UPDATE shop_slots SET sold_count = sold_count + 1 WHERE id = ?').run(slotId);
    db.prepare('INSERT INTO shop_purchases (user_id, slot_id, price) VALUES (?, ?, ?)').run(userId, slotId, slot.price);

    if (slot.item_type === 'pack' && slot.pack_type) {
      db.prepare('INSERT INTO pack_inventory (user_id, pack_type) VALUES (?, ?)').run(userId, slot.pack_type);
    } else if (slot.item_type === 'coins' && slot.coin_amount) {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(slot.coin_amount, userId);
    }
  })();

  const updated = getUserById(userId)!;
  recordCoinTransaction(userId, -slot.price, updated.coins, 'pack_purchase', `Shop purchase: ${slot.slot_key}`);
  if (slot.item_type === 'coins' && slot.coin_amount) {
    recordCoinTransaction(userId, slot.coin_amount, updated.coins + slot.coin_amount, 'reward', `Shop coins: ${slot.slot_key}`);
  }

  return { item_type: slot.item_type, pack_type: slot.pack_type ?? undefined, coin_amount: slot.coin_amount ?? undefined, newBalance: updated.coins };
}
