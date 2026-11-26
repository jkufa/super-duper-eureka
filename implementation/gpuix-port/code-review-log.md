# Code review log

For PR review agents only. Orchestration and implementation agents do not read this file.

## How to use it

1. After each review, add one entry per code smell or implementer habit you found. Skip one-off typos and anything the lint task already catches.
2. Before adding an entry, search this file for the same problem.
3. If it has happened before, add a guideline to "Lessons From Review" in `AGENTS.md`, phrased as an instruction, and set `Promoted` to yes on every matching entry here.

## Entry format

```
### YYYY-MM-DD, spec N, short name of the problem
- Where: file paths or PR
- What: what the implementer did
- Better: what they should do
- Seen before: no, or the dates of earlier entries
- Promoted: no, or yes with the AGENTS.md bullet
```

## Entries

### 2026-11-26, spec 1, build cache omits a build-time environment variable

- Where: `apps/webapp-legacy/vite.config.ts` (431835c)
- What: The legacy build substitutes `MOCK_REAL_DATA` at compile time, but changes to the variable leave the Vite Task cache warm.
- Better: Declare compile-time environment variables as cache inputs and verify that changing a value triggers a fresh build.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, cached generator omits required artifacts

- Where: `apps/webapp-legacy/vite.config.ts` (b2a73a2)
- What: A cached SvelteKit sync can replay success without restoring the generated tsconfig that the next command requires.
- Better: Restore the generator's outputs on a hit or execute the generator uncached.
- Seen before: no
- Promoted: no

### 2026-11-26, spec 1, task migration leaves app setup instructions behind

- Where: `apps/webapp-legacy/README.md` (431835c)
- What: Removing the package scripts broke the app README's development and build commands. Its recreation command also installs the retired tools.
- Better: Check workspace-level setup instructions when removing scripts or replacing tooling.
- Seen before: no
- Promoted: no
