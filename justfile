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
