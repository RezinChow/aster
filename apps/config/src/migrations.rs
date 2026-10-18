//! a3s-orm migration manifest — schema is managed only through Migrator.

use a3s_orm::Migration;

pub fn migrations() -> Vec<Migration> {
    vec![Migration::new(
        "001",
        "config center init",
        include_str!("../migrations/001_init.sql"),
    )]
}
