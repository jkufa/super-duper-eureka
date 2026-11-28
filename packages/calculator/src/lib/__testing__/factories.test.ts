import { describe, expect, it } from 'vite-plus/test';

import { parseScenario } from '../parse-scenario';
import { FACTORY_TODAY, makeAccount, makeRule, makeScenarioFile } from './factories';

describe('test factories', () => {
  it('make a file the parser accepts, with the given fields replacing the defaults', () => {
    const file = makeScenarioFile({
      interest: { annualRate: 0.07 },
      accounts: [makeAccount({ balance: 5, contributions: [makeRule({ amount: 10 })] })]
    });
    const scenario = parseScenario(file, { today: FACTORY_TODAY });

    expect(scenario.interest).toStrictEqual({
      annualRate: 0.07,
      variance: 0,
      compounding: 'monthly'
    });
    expect(scenario.accounts[0]?.balance).toBe(5);
    expect(scenario.accounts[0]?.contributions[0]?.amount).toBe(10);
  });
});
