import { describe, expect, it } from 'vite-plus/test';

import { createSeededRandom } from '../random';

describe('createSeededRandom', () => {
  it('creates a seeded RNG that is stable', () => {
    const rngA = createSeededRandom(42);
    const rngB = createSeededRandom(42);

    expect(rngA()).toBeCloseTo(rngB(), 12);
    expect(rngA()).toBeCloseTo(rngB(), 12);
  });

  it('draws 0.6011037519201636 and then 0.44829055899754167 from seed 42', () => {
    const random = createSeededRandom(42);

    expect([random(), random()]).toStrictEqual([0.6011037519201636, 0.44829055899754167]);
  });
});
