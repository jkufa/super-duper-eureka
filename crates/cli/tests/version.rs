use std::process::Command;

#[test]
fn prints_the_crate_version_and_exits_zero() -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new(env!("CARGO_BIN_EXE_retirement-calc")).output()?;

    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout)?,
        format!("{}\n", env!("CARGO_PKG_VERSION"))
    );
    Ok(())
}
