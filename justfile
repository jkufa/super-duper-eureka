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

# Rewrites the expected files under crates/cli/tests/golden/ from the release Rust CLI. The new
# set replaces the old one whole, or the old one stays.
golden:
    #!/usr/bin/env bash
    set -euo pipefail
    cargo build --release -p retirement-cli
    cli=target/release/retirement-calc
    golden=crates/cli/tests/golden
    staged=$(mktemp -d crates/cli/tests/.golden-new-XXXXXX)
    retired=$(mktemp -d crates/cli/tests/.golden-old-XXXXXX)
    trap 'rm -rf "$staged" "$retired"' EXIT
    cp -R "$golden/." "$staged/"
    write() {
        local out=$1
        shift
        local status=0
        "$cli" "$@" > "$out" 2>/dev/null || status=$?
        if [[ $status != 0 && $status != 2 ]]; then
            echo "$out: retirement-calc exited $status" >&2
            exit 1
        fi
    }
    for case in "$staged"/*/*/; do
        args=(--scenario "${case}scenario.json" --today "$(<"${case}today")")
        write "${case}projection.json" "${args[@]}"
        if [[ -f "${case}trace" ]]; then
            write "${case}trace.json" "${args[@]}" --trace "$(<"${case}trace")"
        fi
    done
    mv "$golden" "$retired/golden"
    if ! mv "$staged" "$golden"; then
        mv "$retired/golden" "$golden"
        exit 1
    fi
    echo "Rewrote the expected files in $golden." >&2
