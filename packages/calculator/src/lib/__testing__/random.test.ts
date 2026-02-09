import { describe, expect, it, vi } from 'vitest';

import { createRandomSeed, createSeededRandom, generateRandomRetirementConfig } from '../random';

const setSystemTime = (isoDate: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
};

const resetTimers = () => {
  vi.useRealTimers();
};

describe('random config generation', () => {
  it('is deterministic for a given seed', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    const configA = generateRandomRetirementConfig(123456);
    const configB = generateRandomRetirementConfig(123456);

    expect(configA).toEqual(configB);
    resetTimers();
  });

  it('produces different outputs for different seeds', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    const configA = generateRandomRetirementConfig(1);
    const configB = generateRandomRetirementConfig(2);

    expect(configA).not.toEqual(configB);
    resetTimers();
  });

  it('keeps salaries and balances within expected ranges', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    const config = generateRandomRetirementConfig(7890);

    expect(config.salary.annualBase).toBeGreaterThanOrEqual(25000);
    expect(config.salary.annualBase).toBeLessThanOrEqual(250000);
    expect(config.currentBalance).toBeGreaterThanOrEqual(0);
    expect(config.currentBalance).toBeLessThanOrEqual(2_000_000);

    resetTimers();
  });

  it('randomizes which contribution rules are included across seeds', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    const contributionSets = new Set<string>();
    let sawSubset = false;
    for (let seed = 1; seed <= 100; seed += 1) {
      const config = generateRandomRetirementConfig(seed);
      const sortedIds = config.contributions.map(rule => rule.id).sort();
      contributionSets.add(sortedIds.join(','));
      if (config.contributions.length < 12) {
        sawSubset = true;
      }
    }

    expect(sawSubset).toBe(true);
    expect(contributionSets.size).toBeGreaterThan(1);

    resetTimers();
  });

  it('rounds salaryPercent contribution amounts to 2 decimals', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    for (let seed = 1; seed <= 100; seed += 1) {
      const config = generateRandomRetirementConfig(seed);
      for (const rule of config.contributions) {
        if (rule.type !== 'salaryPercent') continue;
        expect(rule.amount).toBeCloseTo(Number(rule.amount.toFixed(2)), 12);
      }
    }

    resetTimers();
  });

  it('applies expected rounding for seed 918326173 percent contributions', () => {
    setSystemTime('2026-01-01T00:00:00.000Z');

    const config = generateRandomRetirementConfig(918326173);
    const employee401k = config.contributions.find((rule) => rule.id === '401k-employee');

    expect(employee401k?.type).toBe('salaryPercent');
    expect(employee401k?.amount).toBe(11.96);

    resetTimers();
  });
});

describe('seed utilities', () => {
  it('creates a seeded RNG that is stable', () => {
    const rngA = createSeededRandom(42);
    const rngB = createSeededRandom(42);

    expect(rngA()).toBeCloseTo(rngB(), 12);
    expect(rngA()).toBeCloseTo(rngB(), 12);
  });

  it('creates non-zero seeds', () => {
    const seed = createRandomSeed();
    expect(Number.isFinite(seed)).toBe(true);
  });
});
