import { CEFR_LEVELS, type CefrLevel, type ExerciseType, type PlacementSelfAssessment, type Skill, type Verdict } from '@linguapath/shared';

/**
 * Computer-adaptive placement test on a Rasch-type model.
 *
 * Every item gets a difficulty on the ability scale from its CEFR level and its
 * in-level difficulty (1–3). After each answer the ability is re-estimated over a grid
 * (expected a posteriori with a normal prior centred on the learner's self-assessment),
 * and the next item is the one that is most informative at the current estimate while
 * keeping skills balanced. The test stops when the estimate is precise enough.
 *
 * Difficulties are set by the authors, not calibrated on real learners; the result is
 * therefore an approximate placement, which the interface says explicitly.
 */

export type SelfAssessment = PlacementSelfAssessment;

export const PLACEMENT_CONFIG = {
  /** Centre of each level on the ability scale. */
  levelCentre: { A1: -1.5, A2: -0.5, B1: 0.5, B2: 1.5, C1: 2.5 } satisfies Record<CefrLevel, number>,
  /**
   * Discrimination: with slope 2 a learner in the middle of a level solves about 88% of the
   * items one level below and 12% of the items one level above (before guessing).
   */
  slope: 2,
  /** Shift of an item inside its level per step of difficulty 1–3. */
  difficultyStep: 0.3,
  /** Prior mean for each self-assessment; the prior is deliberately wide. */
  priorMean: { beginner: -2, basics: -0.8, conversational: 0.3, confident: 1.2, advanced: 2.2 } satisfies Record<SelfAssessment, number>,
  priorSd: 1.25,
  /** Chance of guessing a closed item; "don't know" removes guessing by design. */
  guessing: { closed: 0.2, open: 0 },
  /** "Almost right" counts as partial evidence. */
  almostWeight: 0.7,
  minItems: 8,
  maxItems: 20,
  /** Stop once the posterior standard deviation falls below this. */
  targetSd: 0.35,
  /** Penalty per already used item of the same skill, so the test covers all skills. */
  skillBalance: 0.06,
};

const CLOSED_TYPES: ExerciseType[] = ['choice', 'dialogue', 'order'];

export interface PlacementItem {
  key: string;
  level: CefrLevel;
  difficulty: number;
  skill: Skill;
  type: ExerciseType;
  /** Fill-in items with options are closed too. */
  hasOptions?: boolean;
}

export interface PlacementResponse {
  item: PlacementItem;
  verdict: Verdict;
}

const GRID = Array.from({ length: 151 }, (_, i) => -3.5 + i * 0.05);

export function itemDifficulty(item: Pick<PlacementItem, 'level' | 'difficulty'>) {
  return PLACEMENT_CONFIG.levelCentre[item.level] + (item.difficulty - 2) * PLACEMENT_CONFIG.difficultyStep;
}

function guessing(item: PlacementItem) {
  return CLOSED_TYPES.includes(item.type) || item.hasOptions ? PLACEMENT_CONFIG.guessing.closed : PLACEMENT_CONFIG.guessing.open;
}

/** Probability of a correct answer at ability theta (three-parameter logistic model). */
export function pCorrect(item: PlacementItem, theta: number) {
  const c = guessing(item);
  return c + (1 - c) / (1 + Math.exp(-PLACEMENT_CONFIG.slope * (theta - itemDifficulty(item))));
}

function evidence(verdict: Verdict): number | null {
  if (verdict === 'skipped') return null;
  if (verdict === 'correct') return 1;
  if (verdict === 'almost') return PLACEMENT_CONFIG.almostWeight;
  return 0;
}

export function estimateAbility(responses: PlacementResponse[], self: SelfAssessment) {
  const mean0 = PLACEMENT_CONFIG.priorMean[self];
  const sd0 = PLACEMENT_CONFIG.priorSd;
  const logPost = GRID.map((theta) => {
    let lp = -((theta - mean0) ** 2) / (2 * sd0 ** 2);
    for (const r of responses) {
      const w = evidence(r.verdict);
      if (w === null) continue;
      const p = pCorrect(r.item, theta);
      lp += w * Math.log(p) + (1 - w) * Math.log(1 - p);
    }
    return lp;
  });
  const max = Math.max(...logPost);
  const weights = logPost.map((lp) => Math.exp(lp - max));
  const total = weights.reduce((a, b) => a + b, 0);
  const theta = GRID.reduce((s, t, i) => s + t * weights[i]!, 0) / total;
  const variance = GRID.reduce((s, t, i) => s + (t - theta) ** 2 * weights[i]!, 0) / total;
  return { theta, sd: Math.sqrt(variance) };
}

/** Fisher information of an item at theta for the three-parameter model. */
function information(item: PlacementItem, theta: number) {
  const c = guessing(item);
  const p = pCorrect(item, theta);
  return PLACEMENT_CONFIG.slope ** 2 * ((p - c) / (1 - c)) ** 2 * ((1 - p) / p);
}

export function nextItem(bank: PlacementItem[], answered: PlacementResponse[], theta: number): PlacementItem | null {
  const used = new Set(answered.map((r) => r.item.key));
  const skillCount = new Map<Skill, number>();
  for (const r of answered) skillCount.set(r.item.skill, (skillCount.get(r.item.skill) ?? 0) + 1);
  let best: PlacementItem | null = null;
  let bestScore = -Infinity;
  for (const item of bank) {
    if (used.has(item.key)) continue;
    const score = information(item, theta) - PLACEMENT_CONFIG.skillBalance * (skillCount.get(item.skill) ?? 0);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

export function shouldStop(answered: PlacementResponse[], sd: number, bankLeft: number) {
  const counted = answered.filter((r) => r.verdict !== 'skipped').length;
  if (bankLeft === 0 || answered.length >= PLACEMENT_CONFIG.maxItems) return true;
  return counted >= PLACEMENT_CONFIG.minItems && sd <= PLACEMENT_CONFIG.targetSd;
}

export type LevelBand = 'low' | 'mid' | 'high';

/** Level boundaries lie halfway between level centres. */
export function levelFromAbility(theta: number): { level: CefrLevel; band: LevelBand } {
  const centres = PLACEMENT_CONFIG.levelCentre;
  let level: CefrLevel = 'A1';
  for (const l of CEFR_LEVELS) if (theta >= centres[l] - 0.5) level = l;
  const offset = theta - centres[level];
  const band: LevelBand = offset < -1 / 6 ? 'low' : offset > 1 / 6 ? 'high' : 'mid';
  return { level, band };
}

export function confidenceFromSd(sd: number): 'high' | 'medium' | 'low' {
  return sd <= PLACEMENT_CONFIG.targetSd ? 'high' : sd <= 0.5 ? 'medium' : 'low';
}

export function summarizePlacement(responses: PlacementResponse[], self: SelfAssessment) {
  const { theta, sd } = estimateAbility(responses, self);
  const { level, band } = levelFromAbility(theta);
  const tally = <K extends string>(key: (r: PlacementResponse) => K) => {
    const map = new Map<K, { correct: number; total: number }>();
    for (const r of responses) {
      if (r.verdict === 'skipped') continue;
      const row = map.get(key(r)) ?? { correct: 0, total: 0 };
      row.total += 1;
      if (r.verdict === 'correct') row.correct += 1;
      map.set(key(r), row);
    }
    return map;
  };
  const byLevel = tally((r) => r.item.level);
  const bySkill = tally((r) => r.item.skill);
  return {
    theta,
    sd,
    level,
    band,
    confidence: confidenceFromSd(sd),
    perLevel: CEFR_LEVELS.filter((l) => byLevel.has(l)).map((l) => ({ level: l, ...byLevel.get(l)! })),
    perSkill: [...bySkill.entries()].map(([skill, v]) => ({ skill, ...v })),
    answered: responses.filter((r) => r.verdict !== 'skipped').length,
  };
}
