export const STREAK_MILESTONES = [3, 7, 14];

export const MILESTONE_LABELS = {
  3: "Seedling",
  7: "Sapling",
  14: "Tree",
};

export const REWARD_MIN_STREAK = 3;

export const GROWTH_STAGE_LEVELS = {
  seedling: 2,
  sapling: 3,
  tree: 4,
};

export function stageForGrowth(growthLevel) {
  if (growthLevel >= GROWTH_STAGE_LEVELS.tree) return "tree";
  if (growthLevel >= GROWTH_STAGE_LEVELS.sapling) return "sapling";
  if (growthLevel >= GROWTH_STAGE_LEVELS.seedling) return "seedling";
  return "seed";
}
