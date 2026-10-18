//! Pure contracts shared by A3S OCI Runtime host components.

mod capability;
pub mod hardware_vm;
mod lifecycle;

pub use capability::{
    CapabilityStatus, DriverCapability, DriverKind, DriverReadiness, HostPlatform, IsolationClass,
    RuntimeFeatures, FEATURES_SCHEMA_VERSION,
};
pub use lifecycle::{LifecycleEvent, LifecycleState, TransitionError};
