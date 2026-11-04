//! Framework-independent Wicked Learning policies and value types.
//!
//! Domain modules must not depend on Axum, SQLx, HTTP DTOs or React payloads.

pub mod identity_access;
pub mod learner_state;
pub mod platform_presentation;
pub mod world_content;
