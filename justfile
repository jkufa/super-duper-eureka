# Install the tools once (Homebrew, 2026-11-27):
#   brew install rust just cargo-nextest cargo-deny cargo-shear
# Versions: rustc 1.100.0, just 1.59.0, cargo-nextest 0.9.152, cargo-deny 0.22.1, cargo-shear 1.14.1.
# Without Homebrew: cargo install --locked just cargo-nextest cargo-deny cargo-shear

set shell := ["bash", "-euo", "pipefail", "-c"]

check:
    cargo fmt --all --check
    cargo clippy --workspace --all-targets -- -D warnings
    cargo nextest run --workspace
    cargo deny check
    cargo shear

fix:
    cargo fmt --all
    cargo clippy --fix --workspace --all-targets --allow-dirty

# Rewrites the expected files under crates/cli/tests/golden/ from the release Rust CLI, with the
# trace files the golden test's trace rule asks for, and replaces the set whole. The case folders,
# the manifest and the counts in crates/cli/tests/golden.rs must already agree, or nothing changes:
# to add a case, add its folder with scenario.json and today, its manifest line and its count. A
# run is refused while another run or the golden tests hold the set, and the next run cleans up
# after a killed one.
golden:
    cargo test --release -p retirement-cli --test golden -- --ignored --exact publish_the_golden_set
