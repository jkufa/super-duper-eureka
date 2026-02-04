import { calculateProjections, type RetirementConfig } from '../calculator';

const calculateExpectedBalance = (principal: number, annualRate: number, years: number, startMonth = 0) => {
  return principal * (1 + annualRate / 12) ** (12 * years - startMonth);
};

const calculateExpectedMonthlyWithContributions = (
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  totalMonths: number,
) => {
  const r = annualRate / 12;
  const compoundedPrincipal = principal * (1 + r) ** totalMonths;
  const futureValueOfAnnuity = monthlyContribution * ((1 + r) ** totalMonths - 1) / r;
  return compoundedPrincipal + futureValueOfAnnuity;
};

const calculateExpectedAnnualWithContributions = (
  principal: number,
  annualContribution: number,
  annualRate: number,
  totalYears: number,
) => {
  const monthlyRate = annualRate / 12;
  const effectiveAnnualRate = (1 + monthlyRate) ** 12 - 1;
  const compoundedPrincipal = principal * (1 + effectiveAnnualRate) ** totalYears;
  const futureValueOfAnnuity = annualContribution * ((1 + effectiveAnnualRate) ** totalYears - 1) / effectiveAnnualRate;
  return compoundedPrincipal + futureValueOfAnnuity;
};

describe('calculator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no contributions', () => {
    it('should calculate projections', () => {
      vi.setSystemTime(new Date('2026-02-03T00:00:00.000Z'));

      const config: RetirementConfig = {
        currentBalance: 100000,
        timeHorizon: 10,
        interest: { rate: 0.05, variance: 0.02, frequency: 'monthly' },
        salary: { base: 100000, cap: Infinity, raise: { type: 'salaryPercent', rate: 0.00, frequency: 'annual' } },
        customVariables: { oneTime: [], monthly: [], annual: [] },
      };
      const result = calculateProjections(config);
      expect(result).toBeDefined();
      const expectedBalance = calculateExpectedBalance(
        config.currentBalance,
        config.interest.rate,
        config.timeHorizon,
        1, // February
      );

      expect(result.finalBalance).toBeCloseTo(expectedBalance, 2);
    });
  });

  describe('with contributions', () => {
    it('should calculate projections with one flat monthly contribution at the end of the month', () => {
      vi.setSystemTime(new Date('2026-02-03T00:00:00.000Z'));

      const monthlyContribution = 1000;
      const config: RetirementConfig = {
        currentBalance: 100000,
        timeHorizon: 10,
        interest: { rate: 0.05, variance: 0.02, frequency: 'monthly' },
        salary: { base: 100000, cap: Infinity, raise: { type: 'salaryPercent', rate: 0.00, frequency: 'annual' } },
        customVariables: {
          oneTime: [],
          monthly: [
            {
              id: '1',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: monthlyContribution },
              timing: {
                frequency: 'monthly',
                when: 'end',
                yearRange: { start: 0, end: 10 },
              },
            },
          ],
          annual: [],
        },
      };

      const result = calculateProjections(config);
      expect(result).toBeDefined();
      const expectedBalance = calculateExpectedMonthlyWithContributions(
        config.currentBalance,
        monthlyContribution,
        config.interest.rate,
        10 * 12 - 1,
      );
      expect(result.finalBalance).toBeCloseTo(expectedBalance, 2);
    });

    it('should calculate projections with one flat annual contribution at the end of the year', () => {
      vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));

      const annualContribution = 12000;
      const config: RetirementConfig = {
        currentBalance: 100000,
        timeHorizon: 10,
        interest: { rate: 0.05, variance: 0.02, frequency: 'monthly' },
        salary: { base: 100000, cap: Infinity, raise: { type: 'salaryPercent', rate: 0.00, frequency: 'annual' } },
        customVariables: {
          oneTime: [],
          monthly: [],
          annual: [
            {
              id: '1',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: annualContribution },
              timing: {
                frequency: 'annual',
                month: 0,
                when: 'end',
                yearRange: { start: 0, end: 10 },
              },
            },
          ],
        },
      };

      const result = calculateProjections(config);
      expect(result).toBeDefined();
      const expectedBalance = calculateExpectedAnnualWithContributions(
        config.currentBalance,
        annualContribution,
        config.interest.rate,
        config.timeHorizon,
      );
      expect(result.finalBalance).toBeCloseTo(expectedBalance, 2);
    });

    it('should calculate projections with one flat one time contribution', () => {
      vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));

      const config: RetirementConfig = {
        currentBalance: 100000,
        timeHorizon: 10,
        interest: { rate: 0.05, variance: 0.02, frequency: 'monthly' },
        salary: { base: 100000, cap: Infinity, raise: { type: 'salaryPercent', rate: 0.00, frequency: 'annual' } },
        customVariables: {
          oneTime: [
            {
              id: '1',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: 1000 },
              timing: { frequency: 'oneTime', month: 1, year: 0, yearRange: { start: 0, end: 10 } },
            },
          ],
          monthly: [],
          annual: [],
        },
      };
      const result = calculateProjections(config);
      expect(result).toBeDefined();
      const expectedBalance = calculateExpectedBalance(
        config.currentBalance,
        config.interest.rate,
        config.timeHorizon,
        0, // January
      );
      expect(result.finalBalance).toBeCloseTo(expectedBalance, 2);
    });

    it('should calculate projections with various contributions', () => {
      vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));

      const config: RetirementConfig = {
        currentBalance: 100000,
        timeHorizon: 10,
        interest: { rate: 0.05, variance: 0.02, frequency: 'monthly' },
        salary: { base: 100000, cap: Infinity, raise: { type: 'salaryPercent', rate: 0.00, frequency: 'annual' } },
        customVariables: {
          oneTime: [],
          monthly: [
            {
              id: '1',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: 500 },
              timing: {
                frequency: 'monthly',
                when: 'start',
                yearRange: { start: 0, end: 10 },
              },
            },
            {
              id: '2',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: 500 },
              timing: {
                frequency: 'monthly',
                when: 'end',
                yearRange: { start: 0, end: 10 },
              },
            },
          ],
          annual: [
            {
              id: '3',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: 1000 },
              timing: {
                frequency: 'annual',
                month: 0,
                when: 'end',
                yearRange: { start: 0, end: 10 },
              },
            },
            {
              id: '4',
              name: 'Test',
              enabled: true,
              contribution: { type: 'flat', amount: 1000 },
              timing: {
                frequency: 'annual',
                month: 0,
                when: 'end',
                yearRange: { start: 0, end: 10 },
              },
            },
          ],
        },
      };
      const result = calculateProjections(config);
      expect(result).toBeDefined();
    });
  });
});
