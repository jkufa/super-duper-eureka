# Mock real data seed and config generation

## Problem

UI development needed realistic, varied mock configs for US households, with deterministic generation via a seed and a server-side flag.

## Solution

- Added seeded random config generation utilities in the calculator package and exported them.
- Wired the webapp server load to use `MOCK_REAL_DATA=true` to generate a new seed and config per request, returning the seed to the client and logging it.
- Added an `.env.example` flag and smoke tests for determinism and ranges.

## Projection start date

- The webapp overrides the mock generator's January 1 date with the same current date it uses for standard defaults. Otherwise the first calendar year includes contributions from January onward.
- The browser restores the start date from its saved config. An existing January 1 config needs its date updated separately.
- The calculator emits annual snapshots in December and at the end of the projection. Sampling every 12 elapsed months caused the chart to show the next year's balance under the first calendar year's label.
