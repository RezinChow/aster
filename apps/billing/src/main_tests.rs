#![cfg(test)]

use super::require_database_url;

#[test]
fn an_unset_database_url_names_postgres() {
    let error = require_database_url(None).unwrap_err();
    assert!(error.contains("A3S_BILLING_DATABASE_URL"));
    assert!(error.contains("Postgres"));
}

#[test]
fn an_empty_database_url_names_postgres() {
    let error = require_database_url(Some("   ")).unwrap_err();
    assert!(error.contains("A3S_BILLING_DATABASE_URL"));
    assert!(error.contains("Postgres"));
}

#[test]
fn a_postgres_url_is_kept() {
    let url = "postgres://a3s_billing:a3s_billing@127.0.0.1:5432/a3s_billing";
    assert_eq!(require_database_url(Some(url)).unwrap(), url);
}
