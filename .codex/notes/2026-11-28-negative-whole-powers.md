# Bun's `**` on negative whole powers

Found while porting the schedule builder (spec 4 part A), 2026-11-28.

- Bun 1.4.5's `x ** n` matches Rust's `f64::powi` only for `n >= 0`. For `n < 0` it matches `f64::powf`.
- Measured on 200,000 random inputs, `x` in (0.01, 1.99), `|n|` from 1 to 80. Negative `n`: `powf` matched 100,000 of 100,000 and `powi` 12,695. Positive `n`: `powi` matched 100,000 and `powf` 13,304.
- `powi(-n)` computes `1 / x^n`. Bun computes `pow(x, -n)` from libm.
- Constant inputs mislead: LLVM and JavaScriptCore both fold `1.03 ** 7` at compile time. Read inputs at run time, or use `std::hint::black_box`, when measuring.
- The only negative whole power in the engine is `salaryInYear` for a year before `salary.asOf`. Smallest case: `annualBase` 50,000, `annualRaiseRate` 0.03, `asOf` 2029-01-01, year 2026. Bun gives `0x40e657a2a7abca34`, `powi` gives `0x40e657a2a7abca35`.
- Using `powf` when the exponent is negative and `powi` otherwise removed every difference on 1,200 generated scenarios.
