# super-duper-eureka

A retirement projection engine and CLI in Rust. A desktop app on GPUI comes next. See `implementation/rust-redesign/README.md` for the plan.

## Repository Layout

- `crates/core`: the projection engine, a pure library
- `crates/cli`: the `retirement-calc` command-line interface, with example scenarios in `crates/cli/examples/`
- `implementation`: specs and design notes
- `qa`: QA notes and rollout tracking

## Getting Started

Install the tools listed at the top of the `justfile`, then run every check:

```bash
just check
```

## CLI Usage

Project a scenario:

```bash
cargo run -p retirement-cli -- --scenario crates/cli/examples/basic.json --today 2026-01-01
```

Trace one account:

```bash
cargo run -p retirement-cli -- --scenario crates/cli/examples/daily.json --today 2026-02-01 --trace brokerage
```
