import type { Recommendation, RecommendationResult } from '@linguapath/shared';
import { DEFAULT_ENGINE_CONFIG, REVIEW_MINUTES_PER_CARD, type EngineConfig } from './config';

/** Activities that should open a session when present, in this order. */
const LEADING_TYPES = ['placement', 'resume', 'review'] as const;

/**
 * Composes a daily plan that fits the learner's time budget: unfinished work and
 * due reviews come first, then the highest-scored activities while time remains.
 * An activity that does not fit is skipped, but cheaper ones further down the
 * ranking may still fill the remaining minutes. At least one learning activity is
 * always included so the plan is never empty.
 */
export function composePlan(result: RecommendationResult, budgetMinutes: number, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): Recommendation[] {
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
      // Reviews are capped to a share of the budget so new material and remedial work still fit.
      const minutes = Math.min(item.estimatedMinutes, Math.max(2, Math.floor(budgetMinutes * cfg.plan.reviewShare)));
      // The card count shrinks with the minutes, so the plan item is completed when the capped share is done.
      const count = item.target.reviewCount;
      const reviewCount = count === undefined ? undefined : Math.max(1, Math.min(count, Math.floor(minutes / REVIEW_MINUTES_PER_CARD)));
      take({ ...item, estimatedMinutes: minutes, target: { ...item.target, reviewCount } });
    } else take(item);
  }

  for (const item of result.items) {
    if (plan.some((p) => p.key === item.key)) continue;
    if (item.type === 'level_up') continue;
    const limit = cfg.plan.remedialLimit[item.type];
    if (limit !== undefined && plan.filter((p) => p.type === item.type).length >= limit) continue;
    const learningItems = plan.filter((p) => p.type !== 'review').length;
    if (used + item.estimatedMinutes <= budgetMinutes || learningItems === 0) take(item);
  }

  const levelUp = result.items.find((i) => i.type === 'level_up');
  if (levelUp) plan.push(levelUp);
  return plan;
}
