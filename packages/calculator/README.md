# @retirement/calculator

Core retirement calculator with an extensible, config driven model. It focuses on clear inputs and deterministic projections so the same config can power the CLI and future UI.

## Installation

```bash
bun install
```

## Usage

```ts
import { calculateProjection } from '@retirement/calculator';

const projection = calculateProjection(config, config.interest.annualRate);
```

## RetirementConfig

All fields are required unless noted. Dates follow JavaScript Date conventions. Months are 0 to 11, days are 1 to 31.

- `currentBalance`: number. Current invested balance.
- `timeHorizonYears`: number. Projection length in years.
- `startDate`: Date or string. Optional. Anchors the start month of the projection. Defaults to now.
- `interest`: object.
- `interest.annualRate`: number. Annual interest rate as a decimal. Example 0.07.
- `interest.variance`: number. Optional. Variance around the annual rate. Example 0.01 for plus or minus 1 percent.
- `interest.compounding`: `monthly` or `daily`. Optional. Default is monthly.
- `salary`: object.
- `salary.annualBase`: number. Annual salary used for salary percent contributions.
- `salary.annualRaiseRate`: number. Optional. Applied at the start of each projection year. Default is 0.
- `contributions`: array of contribution rules.

### ContributionRule

- `id`: string. Stable identifier.
- `name`: string. Optional.
- `enabled`: boolean. Optional. Default is true.
- `type`: `flat` or `salaryPercent`.
- `amount`: number. For `flat`, this is currency. For `salaryPercent`, this is a decimal percent. Example 0.1 for 10 percent.
- `salaryBasis`: `annual`, `monthly`, `biweekly`, `weekly`, `daily`, or `perContribution`. Optional. Applies only to `salaryPercent`. Default is `annual`.
- `timing`: when the contribution occurs.
- `yearRange`: optional. Limits which projection years the rule applies to. Both values are relative to the projection start year.
- `yearRange.start`: number. Optional. Default is 0.
- `yearRange.end`: number. Optional. Default is `timeHorizonYears`.

### ContributionTiming

- `frequency`: `monthly`, `annual`, or `oneTime`.

Monthly timing
- `day`: number. Optional. 1 to 31. Used with daily compounding.
- `placement`: `start` or `end`. Optional. Default is `start`.

Annual timing
- `month`: number. 0 to 11.
- `day`: number. Optional. 1 to 31. Used with daily compounding.
- `placement`: `start` or `end`. Optional. Default is `start`.

One time timing
- `on.month`: number. 0 to 11.
- `on.year`: number. 0 based projection year.
- `on.day`: number. Optional. 1 to 31. Used with daily compounding.

## Example

```json
{
  "currentBalance": 25000,
  "timeHorizonYears": 25,
  "startDate": "2026-01-01T00:00:00.000Z",
  "interest": {
    "annualRate": 0.07,
    "variance": 0.01,
    "compounding": "monthly"
  },
  "salary": {
    "annualBase": 120000,
    "annualRaiseRate": 0.03
  },
  "contributions": [
    {
      "id": "401k",
      "type": "salaryPercent",
      "amount": 0.1,
      "salaryBasis": "annual",
      "timing": {
        "frequency": "monthly",
        "placement": "start"
      }
    },
    {
      "id": "roth",
      "type": "flat",
      "amount": 6000,
      "timing": {
        "frequency": "annual",
        "month": 0,
        "placement": "end"
      }
    },
    {
      "id": "bonus",
      "type": "flat",
      "amount": 10000,
      "timing": {
        "frequency": "oneTime",
        "on": { "year": 2, "month": 5, "day": 15 }
      }
    }
  ]
}
```
