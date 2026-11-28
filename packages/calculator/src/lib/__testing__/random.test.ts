import { describe, expect, it } from 'vite-plus/test';

import { createSeededRandom } from '../random';

describe('createSeededRandom', () => {
  it('creates a seeded RNG that is stable', () => {
    const rngA = createSeededRandom(42);
    const rngB = createSeededRandom(42);

    expect(rngA()).toBeCloseTo(rngB(), 12);
    expect(rngA()).toBeCloseTo(rngB(), 12);
  });
});
