//! Framework-independent Wicked Learning policies and value types.
//!
//! Domain modules must not depend on Axum, SQLx, HTTP DTOs or React payloads.

pub mod access_link;
pub mod authoring;
pub mod identity_access;
pub mod learner_availability;
pub mod learner_state;
pub mod organization;
pub mod platform_presentation;
pub mod world_content;
