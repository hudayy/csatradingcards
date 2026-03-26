import TradingCard from '@/components/TradingCard';
import { getPlayerPool, getGMPool, RARITY_ORDER, RARITY_STAT_MULTIPLIER, type Rarity, type PlayerPool } from '@/lib/cards';

function isWorldClass(tier: string | null | undefined): boolean {
  return tier?.toLowerCase().replace(/[\s_]+/g, '') === 'worldclass';
}

function avgSalary(entries: PlayerPool[]): number {
  if (!entries.length) return 0;
  return entries.reduce((s, e) => s + e.player.active_salary, 0) / entries.length;
}

export default async function ShowcasePage() {
  const [pool, gmPool] = await Promise.all([getPlayerPool(), getGMPool()]);
  const randomGM = gmPool.length > 0 ? gmPool[Math.floor(Math.random() * gmPool.length)] : null;

  // Group players by their actual tier
  const tierGroups = new Map<string, PlayerPool[]>();
  for (const entry of pool) {
    const t = entry.player.tier;
    if (!t) continue;
    if (!tierGroups.has(t)) tierGroups.set(t, []);
    tierGroups.get(t)!.push(entry);
  }

  // Sort tiers by average salary ascending (lowest prestige first),
  // then force World Class to the very end (highest prestige = prismatic)
  const sortedTiers = [...tierGroups.keys()].sort((a, b) => avgSalary(tierGroups.get(a)!) - avgSalary(tierGroups.get(b)!));
  const wcIdx = sortedTiers.findIndex(t => isWorldClass(t));
  if (wcIdx !== -1) sortedTiers.push(sortedTiers.splice(wcIdx, 1)[0]);

  // Map rarities (bronze→prismatic) to tiers
  // If tiers < 7: cycle lower tiers, World Class always stays on prismatic
  const rarities = [...RARITY_ORDER] as Rarity[];
  const tiersForSlots: string[] = [];
  const nonWcTiers = sortedTiers.filter(t => !isWorldClass(t));

  for (let i = 0; i < rarities.length - 1; i++) {
    tiersForSlots.push(nonWcTiers[i % Math.max(nonWcTiers.length, 1)]);
  }
  // Prismatic always gets World Class (or best available if no WC in pool)
  tiersForSlots.push(sortedTiers[sortedTiers.length - 1] ?? nonWcTiers[0]);

  // Pick one player per slot, maximising franchise diversity
  const usedFranchises = new Set<number>();

  function pick(tierName: string): PlayerPool | null {
    const candidates = [...(tierGroups.get(tierName) ?? pool)]
      .sort((a, b) => b.player.active_salary - a.player.active_salary);
    return (
      candidates.find(e => e.player.Franchise?.id != null && !usedFranchises.has(e.player.Franchise.id)) ??
      candidates[0] ??
      null
    );
  }

  const showcaseCards = rarities.map((rarity, i) => {
    const tierName = tiersForSlots[i];
    if (!tierName) return null;

    const entry = pick(tierName);
    if (!entry) return null;

    if (entry.player.Franchise?.id != null) usedFranchises.add(entry.player.Franchise.id);

    const { player, stats, franchise } = entry;
    const mult = RARITY_STAT_MULTIPLIER[rarity];
    const franchiseLogo = franchise?.logo
      ? (franchise.logo.startsWith('http') ? franchise.logo : `https://api.playcsa.com${franchise.logo}`)
      : null;

    return {
      id: `showcase-${rarity}-${player.Player.csa_id}`,
      player_name: player.Player.csa_name,
      player_avatar_url: entry.member?.avatar_url ?? null,
      franchise_name: player.Franchise?.name ?? null,
      franchise_abbr: player.Franchise?.abbr ?? null,
      franchise_logo_url: franchiseLogo,
      franchise_color: franchise?.color ?? null,
      franchise_conf: entry.franchise_conf ?? null,
      tier_name: tierName,
      tier_abbr: tierName.charAt(0),
      rarity,
      stat_gpg:    Math.round((stats?.gpg    ?? 0.7) * mult * 1000) / 1000,
      stat_apg:    Math.round((stats?.apg    ?? 0.5) * mult * 1000) / 1000,
      stat_svpg:   Math.round((stats?.svpg   ?? 1.0) * mult * 1000) / 1000,
      stat_win_pct: Math.round(Math.min((stats?.win_pct ?? 0.5) * mult, 1) * 1000) / 1000,
      salary: player.active_salary,
      overall_rating: Math.round(Math.min(Math.max((player.active_salary / 200) * mult, 30), 99)),
      season_number: 3,
    };
  }).filter(Boolean);

  return (
    <div className="container" style={{ padding: '4rem 2rem' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 className="page-title">Card Rarity Showcase</h1>
        <p className="page-subtitle">All 7 rarity tiers — real CSA players from different tiers and franchises.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
          Featuring live active CSA players pulled directly from the API.
        </p>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '3.5rem', justifyContent: 'center',
        padding: '3rem', background: '#0a0a1a',
        borderRadius: 'var(--radius-xl)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
      }}>
        {showcaseCards.map(card => (
          <TradingCard key={card!.id} card={card!} />
        ))}
      </div>

      {randomGM && (
        <div style={{ marginTop: '5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="page-title" style={{ fontSize: '1.75rem' }}>GM Cards</h2>
            <p className="page-subtitle">General Managers — franchise leaders, one per team.</p>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'center',
            padding: '3rem', background: '#0a0a1a',
            borderRadius: 'var(--radius-xl)', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
          }}>
            <TradingCard card={randomGM} />
          </div>
        </div>
      )}
    </div>
  );
}
