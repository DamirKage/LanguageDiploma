import { describe, expect, it } from 'vitest';
import { PROFILES, runSimulation } from '../../src/modules/recommendations/evaluation/simulator';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('offline evaluation on synthetic learners', () => {
  it('is reproducible for a given seed', () => {
    expect(runSimulation(PROFILES[0]!, 'engine', 7)).toEqual(runSimulation(PROFILES[0]!, 'engine', 7));
  });

  it('beats the strictly sequential baseline on skill, weak-topic coverage and word retention', () => {
    for (const profile of PROFILES.filter((p) => p.name === 'grammar-struggler' || p.name === 'steady-average')) {
      const engine = Array.from({ length: 10 }, (_, i) => runSimulation(profile, 'engine', i + 1));
      const sequential = Array.from({ length: 10 }, (_, i) => runSimulation(profile, 'sequential', i + 1));
      expect(mean(engine.map((r) => r.meanSkill))).toBeGreaterThan(mean(sequential.map((r) => r.meanSkill)) + 0.1);
      expect(mean(engine.map((r) => r.weakCoverage))).toBeGreaterThan(mean(sequential.map((r) => r.weakCoverage)));
      expect(mean(engine.map((r) => r.wordRetention))).toBeGreaterThan(0.4);
    }
  });

  it('stays within the daily time budget on average', () => {
    const profile = PROFILES.find((p) => p.name === 'short-sessions')!;
    const run = runSimulation(profile, 'engine', 3);
    expect(run.minutes / 30).toBeLessThanOrEqual(profile.dailyMinutes + 2);
  });
});
