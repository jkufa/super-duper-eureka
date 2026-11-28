import { describe, expect, it } from 'vite-plus/test';

describe('package surface', () => {
  it('exports only the scenario engine at run time', async () => {
    const calculator = await import('../../index');

    expect(Object.keys(calculator).toSorted()).toStrictEqual([
      'ScenarioError',
      'parseScenario',
      'projectScenario',
      'traceAccount'
    ]);
  });
});
