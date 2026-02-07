# Mock real data seed and config generation

## Problem
UI development needed realistic, varied mock configs for US households, with deterministic generation via a seed and a server-side flag.

## Solution
- Added seeded random config generation utilities in the calculator package and exported them.
- Wired the webapp server load to use `MOCK_REAL_DATA=true` to generate a new seed and config per request, returning the seed to the client and logging it.
- Added an `.env.example` flag and smoke tests for determinism and ranges.
