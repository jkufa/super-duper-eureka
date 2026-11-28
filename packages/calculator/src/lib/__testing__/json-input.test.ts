import { describe, expect, it } from 'vite-plus/test';

import { calculateProjectionWithSteps } from '../calculator';

describe('config read from JSON', () => {
  it('credits a daily-mode deposit whose day is written as a string', () => {
    const config = JSON.parse(`{
      "currentBalance": 0,
      "timeHorizonYears": 1,
      "startDate": "2026-01-01T00:00:00.000Z",
      "interest": { "annualRate": 0, "compounding": "daily" },
      "salary": { "annualBase": 0 },
      "contributions": [
        { "id": "string-day", "type": "flat", "amount": 7, "timing": { "frequency": "monthly", "day": "2" } }
      ]
    }`);
    const run = calculateProjectionWithSteps(config, 0);

    expect(run.steps[0]?.contributionsByDay).toStrictEqual({ 2: 7 });
    expect(run.steps[0]?.balanceEnd).toBe(7);
    expect(run.projection.finalBalance).toBe(84);
  });
});
