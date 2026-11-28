//! The retirement projection engine: pure functions over a validated scenario, with no I/O.

mod compound;
pub mod date;
pub mod project;
pub mod scenario;
pub mod schedule;

#[cfg(test)]
mod arbitrary;
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod properties;
