use super::*;

fn grant(host: &str, port: Option<u16>) -> NetworkGrant {
    NetworkGrant::new(host, port).unwrap()
}

fn mediated(grants: Vec<NetworkGrant>) -> PermissionProfile {
    PermissionProfile::new(SandboxNetworkMode::Mediated, grants).unwrap()
}

#[test]
fn constructor_rejects_inconsistent_profiles() {
    assert_eq!(
        PermissionProfile::new(SandboxNetworkMode::Deny, vec![grant("a.test", None)]),
        Err(ProfileIntersectError::DenyWithGrants)
    );
    assert_eq!(
        PermissionProfile::new(SandboxNetworkMode::Mediated, Vec::new()),
        Err(ProfileIntersectError::MediatedWithoutGrants)
    );
}

#[test]
fn empty_input_is_refused() {
    assert_eq!(
        intersect_permission_profiles(&[]),
        Err(ProfileIntersectError::NoProfiles)
    );
}

#[test]
fn deny_intersect_mediated_is_deny_with_no_grants() {
    let wide = mediated(vec![grant("a.test", None)]);
    for order in [
        [PermissionProfile::deny(), wide.clone()],
        [wide.clone(), PermissionProfile::deny()],
    ] {
        let result = intersect_permission_profiles(&order).unwrap();
        assert_eq!(result.network(), SandboxNetworkMode::Deny);
        assert!(result.network_allow().is_empty());
    }
}

#[test]
fn mediated_allowlists_intersect_and_stay_inside_every_input() {
    let left = mediated(vec![
        grant("a.test", None),
        grant("b.test", Some(443)),
        grant("c.test", Some(80)),
    ]);
    let right = mediated(vec![
        grant("a.test", Some(8080)),
        grant("b.test", None),
        grant("c.test", Some(81)),
        grant("d.test", None),
    ]);
    let result = intersect_permission_profiles(&[left.clone(), right.clone()]).unwrap();
    assert_eq!(
        result.network_allow(),
        &[grant("a.test", Some(8080)), grant("b.test", Some(443))]
    );
    assert!(result.is_subset_of(&left));
    assert!(result.is_subset_of(&right));
    assert!(!left.is_subset_of(&right));
}

#[test]
fn disjoint_mediated_allowlists_refuse_instead_of_opening_network() {
    let error = intersect_permission_profiles(&[
        mediated(vec![grant("a.test", None)]),
        mediated(vec![grant("b.test", None)]),
    ])
    .unwrap_err();
    assert_eq!(error, ProfileIntersectError::EmptyMediatedIntersection);
    assert_eq!(
        error.violation_code().as_str(),
        "sandbox.violation.profile_intersect_refused"
    );
}

#[test]
fn host_matching_is_exact_with_no_aliasing() {
    let result = intersect_permission_profiles(&[
        mediated(vec![grant("localhost", None)]),
        mediated(vec![grant("127.0.0.1", None)]),
    ]);
    assert_eq!(
        result,
        Err(ProfileIntersectError::EmptyMediatedIntersection)
    );
}

#[test]
fn request_wider_than_base_is_narrowed_or_refused() {
    let base = mediated(vec![grant("a.test", Some(443))]);
    let narrowed = intersect_profile_with_request(
        &base,
        &mediated(vec![grant("a.test", None), grant("b.test", None)]),
    )
    .unwrap();
    assert_eq!(narrowed.network_allow(), &[grant("a.test", Some(443))]);

    let refused = intersect_profile_with_request(&base, &mediated(vec![grant("b.test", None)]));
    assert_eq!(
        refused,
        Err(ProfileIntersectError::EmptyMediatedIntersection)
    );
    let denied = intersect_profile_with_request(&PermissionProfile::deny(), &base).unwrap();
    assert_eq!(denied, PermissionProfile::deny());
}

#[test]
fn violation_codes_are_stable_strings() {
    assert_eq!(
        SandboxViolationCode::FilesystemDenied.as_str(),
        "sandbox.violation.filesystem_denied"
    );
    assert_eq!(
        SandboxViolationCode::NetworkDenied.as_str(),
        "sandbox.violation.network_denied"
    );
    assert_eq!(
        SandboxViolationCode::LifetimeUnqualified.as_str(),
        "sandbox.violation.lifetime_unqualified"
    );
    assert_eq!(
        SandboxViolationCode::ProfileIntersectRefused.as_str(),
        "sandbox.violation.profile_intersect_refused"
    );
}

#[test]
fn violation_code_is_found_through_context_but_not_display_text() {
    let typed = anyhow::Error::new(SandboxViolation::new(
        SandboxViolationCode::NetworkDenied,
        "egress to a.test refused",
    ))
    .context("wrapped");
    assert_eq!(
        violation_code_of(&typed),
        Some(SandboxViolationCode::NetworkDenied)
    );
    let text_only = anyhow::anyhow!("{}: lookalike", violation_code::NETWORK_DENIED);
    assert_eq!(violation_code_of(&text_only), None);
}

#[test]
fn intersect_refusal_converts_to_a_typed_violation() {
    let violation = SandboxViolation::from(ProfileIntersectError::EmptyMediatedIntersection);
    assert_eq!(
        violation.code(),
        SandboxViolationCode::ProfileIntersectRefused
    );
}
