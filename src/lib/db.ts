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

    CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);
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
  ]) {
    try { db.exec(col); } catch { /* already exists */ }
  }

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
}

export type UserCardWithDetails = UserCard & Card;

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
}): UserCardWithDetails[] {
  let query = `
    SELECT uc.id as user_card_id, uc.user_id, uc.card_id, uc.acquired_at, uc.source, uc.is_listed,
      c.id, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at
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

  query += ' ORDER BY c.overall_rating DESC, uc.acquired_at DESC';

  return getDb().prepare(query).all(...params) as UserCardWithDetails[];
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
  cards: { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null; overall_rating: number }[];
}[] {
  const database = getDb();
  const packs = database.prepare(
    'SELECT id, pack_type, opened_at FROM packs WHERE user_id = ? ORDER BY opened_at DESC LIMIT 100'
  ).all(userId) as { id: number; pack_type: string; opened_at: string }[];

  return packs.map(pack => {
    const cards = database.prepare(`
      SELECT c.rarity, c.player_name, c.player_avatar_url, c.franchise_color, c.overall_rating
      FROM pack_cards pc JOIN cards c ON pc.card_id = c.id
      WHERE pc.pack_id = ?
    `).all(pack.id) as { rarity: string; player_name: string; player_avatar_url: string | null; franchise_color: string | null; overall_rating: number }[];
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
  getDb().prepare('UPDATE user_cards SET is_listed = 1 WHERE id = ?').run(userCardId);
  const result = getDb().prepare(`
    INSERT INTO marketplace_listings (seller_id, user_card_id, card_id, price) VALUES (?, ?, ?, ?)
  `).run(sellerId, userCardId, cardId, price);
  return result.lastInsertRowid as number;
}

export function getActiveListings(filters?: {
  rarity?: string;
  franchiseId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}, limit = 50, offset = 0): ListingWithDetails[] {
  let query = `
    SELECT ml.*, c.player_csa_id, c.player_name, c.player_discord_id, c.player_avatar_url,
      c.season_id, c.season_number, c.franchise_id, c.franchise_name, c.franchise_abbr,
      c.franchise_color, c.franchise_logo_url, c.franchise_conf, c.tier_name, c.tier_abbr,
      c.rarity, c.card_type, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at,
      u.discord_username as seller_name, u.avatar_url as seller_avatar
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

  query += ' ORDER BY ml.listed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return getDb().prepare(query).all(...params) as ListingWithDetails[];
}

export function buyListing(listingId: number, buyerId: number): { success: boolean; error?: string; new_balance?: number } {
  const database = getDb();

  try {
    database.transaction(() => {
      const listing = database.prepare('SELECT * FROM marketplace_listings WHERE id = ? AND status = ?').get(listingId, 'active') as MarketplaceListing | undefined;
      if (!listing) throw new Error('Listing not found or already sold');

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
    return { success: true, new_balance: buyerAfter.coins };
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

export const DAILY_BONUS_AMOUNT = 100;

export function claimDailyBonus(userId: number): { claimed: boolean; amount: number; newBalance: number } {
  const database = getDb();
  const today = new Date().toISOString().split('T')[0];
  const user = getUserById(userId);
  if (!user) return { claimed: false, amount: 0, newBalance: 0 };
  if ((user as User & { last_daily_bonus: string | null }).last_daily_bonus === today) {
    return { claimed: false, amount: 0, newBalance: user.coins };
  }
  database.prepare('UPDATE users SET coins = coins + ?, last_daily_bonus = ? WHERE id = ?').run(DAILY_BONUS_AMOUNT, today, userId);
  const updated = getUserById(userId)!;
  recordCoinTransaction(userId, DAILY_BONUS_AMOUNT, updated.coins, 'daily_bonus', 'Daily login bonus');
  return { claimed: true, amount: DAILY_BONUS_AMOUNT, newBalance: updated.coins };
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
  const row = db.prepare('SELECT id, pack_type FROM pack_inventory WHERE id = ? AND user_id = ?')
    .get(inventoryId, userId) as { id: number; pack_type: string } | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM pack_inventory WHERE id = ?').run(inventoryId);
  return row.pack_type;
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
    SELECT uc.id, uc.user_id, uc.is_listed, c.rarity
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.id = ?
  `).get(userCardId) as { id: number; user_id: number; is_listed: number; rarity: string } | undefined;

  if (!row) throw new Error('Card not found');
  if (row.user_id !== userId) throw new Error('Not your card');
  if (row.is_listed) throw new Error('Cannot salvage a listed card');

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
        SELECT uc.id, uc.user_id, uc.is_listed, c.rarity
        FROM user_cards uc JOIN cards c ON uc.card_id = c.id
        WHERE uc.id = ?
      `).get(userCardId) as { id: number; user_id: number; is_listed: number; rarity: string } | undefined;

      if (!row || row.user_id !== userId || row.is_listed) continue;

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
    SELECT c.player_name, c.rarity, c.overall_rating, c.franchise_name, c.tier_name, c.player_avatar_url
    FROM user_cards uc JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = ? ORDER BY c.overall_rating DESC LIMIT 1
  `).get(userId) as { player_name: string; rarity: string; overall_rating: number; franchise_name: string | null; tier_name: string | null; player_avatar_url: string | null } | undefined;

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

  return { totalCards, listedCards, uniquePlayers, byRarity, byFranchise, bestCard, totalPacksOpened, tradesCompleted, salesCompleted, purchasesCompleted, bySource, recentCards };
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
      c.rarity, c.stat_gpg, c.stat_apg, c.stat_svpg, c.stat_win_pct, c.salary, c.overall_rating, c.created_at
    FROM trade_cards tc
    JOIN user_cards uc ON tc.user_card_id = uc.id
    JOIN cards c ON uc.card_id = c.id
    WHERE tc.trade_id = ? AND tc.side = ?
  `).all(tradeId, side) as UserCardWithDetails[];
}

export function getTradesForUser(userId: number): TradeWithDetails[] {
  const trades = getDb().prepare(`
    SELECT t.*,
      su.discord_username as sender_name, su.avatar_url as sender_avatar,
      ru.discord_username as receiver_name, ru.avatar_url as receiver_avatar
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
    const card = database.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ? AND is_listed = 0').get(id, senderId);
    if (!card) throw new Error('Sender card not found or is listed');
  }
  for (const id of receiverCardIds) {
    const card = database.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ? AND is_listed = 0').get(id, receiverId);
    if (!card) throw new Error('Receiver card not found or is listed');
  }

  let tradeId: number;
  database.transaction(() => {
    const result = database.prepare(`INSERT INTO trades (sender_id, receiver_id, sender_coins, receiver_coins, status) VALUES (?, ?, ?, ?, 'pending')`).run(senderId, receiverId, senderCoins, receiverCoins);
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
        if (!current) throw new Error('Sender no longer owns one of the trade cards');
      }
      for (const card of receiverCards) {
        const current = database.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ? AND is_listed = 0').get(card.user_card_id, trade.receiver_id);
        if (!current) throw new Error('Receiver no longer owns one of the trade cards');
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
