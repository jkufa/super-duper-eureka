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
# trace files the golden test's trace rule asks for and the manifest. The new set replaces the old
# one whole. Until the new set is in place the old one is at crates/cli/tests/.golden-old, and
# this recipe moves it back on exit or, after a kill, on its next run.
golden:
    #!/usr/bin/env bash
    set -euo pipefail
    tests=crates/cli/tests
    golden=$tests/golden
    staged=$tests/.golden-new
    retired=$tests/.golden-old
    settle() {
        if [[ ! -d $golden && -d $retired ]]; then
            mv "$retired" "$golden"
        fi
        rm -rf "$staged"
        if [[ -d $golden ]]; then
            rm -rf "$retired"
        fi
    }
    settle
    trap settle EXIT
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
    cargo test --release -p retirement-cli --test golden -- --ignored --exact write_the_golden_set_to_staging
    mv "$golden" "$retired"
    mv "$staged" "$golden"
    echo "Rewrote the expected files in $golden." >&2
