import type { Recommendation, RecommendationResult } from '@linguapath/shared';

/** Activities that should open a session when present, in this order. */
const LEADING_TYPES = ['placement', 'resume', 'review'] as const;
/** How many activities of a remedial type fit in one day, leaving room for new material. */
const REMEDIAL_LIMIT: Partial<Record<string, number>> = { weak_topic: 2, topic_refresh: 1, retry_lesson: 1 };

/**
 * Composes a daily plan that fits the learner's time budget: unfinished work and
 * due reviews come first, then the highest-scored activities while time remains.
 * At least one learning activity is always included so the plan is never empty.
 */
export function composePlan(result: RecommendationResult, budgetMinutes: number): Recommendation[] {
  const plan: Recommendation[] = [];
  let used = 0;
  const take = (r: Recommendation) => {
    plan.push(r);
    used += r.estimatedMinutes;
  };

  for (const type of LEADING_TYPES) {
    const item = result.items.find((i) => i.type === type);
    if (!item) continue;
    if (type === 'review') {
      // Reviews are capped to half of the budget so new material still fits.
      const minutes = Math.min(item.estimatedMinutes, Math.max(2, Math.floor(budgetMinutes / 2)));
      take({ ...item, estimatedMinutes: minutes });
    } else take(item);
  }

  for (const item of result.items) {
    if (plan.some((p) => p.key === item.key)) continue;
    if (item.type === 'level_up') continue;
    const limit = REMEDIAL_LIMIT[item.type];
    if (limit !== undefined && plan.filter((p) => p.type === item.type).length >= limit) continue;
    const learningItems = plan.filter((p) => p.type !== 'review').length;
    if (used + item.estimatedMinutes <= budgetMinutes || learningItems === 0) take(item);
  }

  const levelUp = result.items.find((i) => i.type === 'level_up');
  if (levelUp) plan.push(levelUp);
  return plan;
}
