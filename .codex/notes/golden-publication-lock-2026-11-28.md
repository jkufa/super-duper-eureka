# Golden publication lock

- `just golden` runs `publish_the_golden_set` in `crates/cli/tests/golden.rs`. Writers take `File::try_lock` on `crates/cli/tests/.golden.lock`; the golden tests take `File::lock_shared`. In Rust 1.100 both are `flock` on macOS and Linux, so a killed process releases its lock.
- `flock` belongs to the open file description. A child spawned by another thread of the same process can hold a copy of the descriptor between fork and exec, so dropping the `File` did not always release the lock at once: the publication tests, which publish and then publish again while other threads spawn the CLI, saw spurious "another regeneration" refusals. `publish` calls `unlock()` explicitly, which releases the lock on the description whatever copies exist.
- The publication tests build small sets under `target/tmp/golden-publication/<test>/`, each with its own lock file.
