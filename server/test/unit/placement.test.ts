import { describe, expect, it } from 'vitest';
import { CEFR_LEVELS, type CefrLevel, type Skill } from '@linguapath/shared';
import {
  PLACEMENT_CONFIG,
  estimateAbility,
  levelFromAbility,
  nextItem,
  pCorrect,
  shouldStop,
  summarizePlacement,
  type PlacementItem,
  type PlacementResponse,
  type SelfAssessment,
} from '../../src/modules/learning/placement';

const SKILLS: Skill[] = ['vocabulary', 'vocabulary', 'vocabulary', 'grammar', 'grammar', 'grammar', 'reading', 'listening'];

/** The same shape as the real bank: 8 items per level, 3 vocabulary, 3 grammar, reading and listening. */
const bank: PlacementItem[] = CEFR_LEVELS.flatMap((level) =>
  SKILLS.map((skill, i) => ({ key: `${level}-${i}`, level, skill, difficulty: (i % 3) + 1, type: i % 4 === 3 ? 'translate' : 'choice' })),
);

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

function run(trueTheta: number, self: SelfAssessment, random: () => number) {
  const responses: PlacementResponse[] = [];
  for (;;) {
    const { theta, sd } = estimateAbility(responses, self);
    const left = bank.length - responses.length;
    if (shouldStop(responses, sd, left)) break;
    const item = nextItem(bank, responses, theta)!;
    responses.push({ item, verdict: random() < pCorrect(item, trueTheta) ? 'correct' : 'incorrect' });
  }
  return { ...summarizePlacement(responses, self), length: responses.length };
}

describe('adaptive placement', () => {
  it('maps the ability scale to levels and sub-bands', () => {
    expect(levelFromAbility(-3)).toEqual({ level: 'A1', band: 'low' });
    expect(levelFromAbility(-0.5)).toEqual({ level: 'A2', band: 'mid' });
    expect(levelFromAbility(0.9).level).toBe('B1');
    expect(levelFromAbility(0.9).band).toBe('high');
    expect(levelFromAbility(1.5).level).toBe('B2');
    expect(levelFromAbility(3).level).toBe('C1');
  });

  it('raises the estimate after correct answers and lowers it after mistakes', () => {
    const item = bank.find((i) => i.level === 'A2')!;
    const start = estimateAbility([], 'basics').theta;
    expect(estimateAbility([{ item, verdict: 'correct' }], 'basics').theta).toBeGreaterThan(start);
    expect(estimateAbility([{ item, verdict: 'incorrect' }], 'basics').theta).toBeLessThan(start);
    expect(estimateAbility([{ item, verdict: 'skipped' }], 'basics').theta).toBeCloseTo(start, 5);
  });

  it('picks the next item near the current estimate and balances skills', () => {
    const first = nextItem(bank, [], PLACEMENT_CONFIG.priorMean.conversational)!;
    expect(['A2', 'B1']).toContain(first.level);
    const answered: PlacementResponse[] = bank.filter((i) => i.skill === 'vocabulary').slice(0, 6).map((item) => ({ item, verdict: 'correct' }));
    expect(nextItem(bank, answered, 0)!.skill).not.toBe('vocabulary');
  });

  it('stops between the minimum and maximum number of items, usually well before the maximum', () => {
    const random = rng(7);
    const lengths: number[] = [];
    for (const theta of [-2, -1.5, -0.5, 0.5, 1.5, 2]) {
      for (let k = 0; k < 10; k++) {
        const { length } = run(theta, 'basics', random);
        expect(length).toBeGreaterThanOrEqual(PLACEMENT_CONFIG.minItems);
        expect(length).toBeLessThanOrEqual(PLACEMENT_CONFIG.maxItems);
        lengths.push(length);
      }
    }
    expect(lengths.reduce((a, b) => a + b, 0) / lengths.length).toBeLessThan(PLACEMENT_CONFIG.maxItems - 2);
  });

  it('places simulated learners at their true level in most runs, whatever they say about themselves', () => {
    const random = rng(42);
    const levels: CefrLevel[] = [...CEFR_LEVELS];
    let exact = 0;
    let withinOne = 0;
    let runs = 0;
    for (const level of levels) {
      for (const self of ['beginner', 'basics', 'conversational', 'confident', 'advanced'] as const) {
        for (let k = 0; k < 25; k++) {
          const result = run(PLACEMENT_CONFIG.levelCentre[level], self, random);
          runs++;
          const diff = Math.abs(levels.indexOf(result.level) - levels.indexOf(level));
          if (diff === 0) exact++;
          if (diff <= 1) withinOne++;
        }
      }
    }
    expect(exact / runs).toBeGreaterThan(0.8);
    expect(withinOne / runs).toBeGreaterThan(0.99);
  });
});
