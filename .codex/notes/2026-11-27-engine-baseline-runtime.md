# Engine baseline: Bun and Node disagree on powers

Spec 2 part A, 2026-11-27.

- The first baseline was written with `bun` and the Vitest run (Node 24.13) failed 227 of 230 cases.
- Cause: JavaScriptCore and V8 compute `x ** n` differently in the last digit. `1.03 ** 4` is `1.12550881` on Bun 1.4.5 and `1.1255088100000001` on Node 24.13. The engine's salary raises and contribution growth use whole-number powers, so yearly salaries and every later balance differ.
- Fix: the writer runs on Node through `vpx` (`vp run @retirement/calculator#write-baseline`) and throws if started under Bun.
- Consequence for spec 4: the CLI runs on Bun and the tests on Node, so the TS oracle gives different last digits depending on how it is run. The parity run must use one runtime, or the tolerance must cover it.
- Timezone: the engine reads `startDate` strings through their UTC fields, so the baseline is the same under `TZ=Pacific/Kiritimati`, `America/Los_Angeles` and `Asia/Kolkata`.
