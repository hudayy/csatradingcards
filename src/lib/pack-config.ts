// Client-safe pack configuration — no Node.js imports

export type PackType = 'standard' | 'elite' | 'apex';

export const PACK_CONFIGS: Record<PackType, {
  name: string;
  subtitle: string;
  flavour: string;
  cost: number;
  allowedRarities: string[];
}> = {
  standard: {
    name: 'Challenger Pack',
    subtitle: 'All Rarities',
    flavour: 'Build your roster. Every rarity in the game.',
    cost: 100,
    allowedRarities: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'],
  },
  elite: {
    name: 'Elite Pack',
    subtitle: 'Silver & Above',
    flavour: 'No commons. No compromises.',
    cost: 500,
    allowedRarities: ['silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'],
  },
  apex: {
    name: 'Apex Pack',
    subtitle: 'Diamond & Above',
    flavour: 'Only the rarest survive.',
    cost: 2000,
    allowedRarities: ['diamond', 'holographic', 'prismatic'],
  },
};
