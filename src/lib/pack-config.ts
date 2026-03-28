// Client-safe pack configuration — no Node.js imports

export type PackType = 'standard' | 'elite' | 'apex' | 'franchise_loyalty';

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
    cost: 200,
    allowedRarities: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'],
  },
  elite: {
    name: 'Prestige Pack',
    subtitle: 'Silver & Above',
    flavour: 'No commons. No compromises.',
    cost: 300,
    allowedRarities: ['silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'],
  },
  apex: {
    name: 'Apex Pack',
    subtitle: 'Diamond & Above',
    flavour: 'Only the rarest survive.',
    cost: 1350,
    allowedRarities: ['diamond', 'holographic', 'prismatic'],
  },
  franchise_loyalty: {
    name: 'Franchise Loyalty Pack',
    subtitle: 'One Franchise Only',
    flavour: 'All 5 cards from the featured franchise. A new franchise drops every day.',
    cost: 350,
    allowedRarities: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'holographic', 'prismatic'],
  },
};
