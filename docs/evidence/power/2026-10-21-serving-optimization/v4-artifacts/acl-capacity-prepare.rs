//! Host-local, root-only capacity preparation. This program NEVER installs a
//! production configuration, prints configuration contents, or changes a unit.
//! Build later against the already pinned workspace rlibs; no new Cargo project.
use a3s_acl::{generate, parse, Block, Document, Value};
use a3s_power::config::PowerConfig;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::Command;

const FIELDS: [&str; 4] = [
    "num_parallel",
    "max_concurrent_requests",
    "max_queued_requests",
    "queue_timeout_ms",
];
const MAX_ACL_BYTES: u64 = 1024 * 1024;

fn approved_original_metadata(
    regular: bool,
    symlink: bool,
    uid: u32,
    gid: u32,
    mode: u32,
    length: u64,
) -> bool {
    // This is the operator-verified service account and file policy on all
    // eight existing instances. Do not infer ownership from the root caller.
    regular
        && !symlink
        && uid == 1000
        && gid == 1000
        && mode & 0o7777 == 0o600
        && length > 0
        && length <= MAX_ACL_BYTES
}

unsafe extern "C" {
    fn geteuid() -> u32;
}

fn without_capacity(document: &Document) -> Document {
    let mut result = document.clone();
    result
        .blocks
        .retain(|block| !FIELDS.contains(&block.name.as_str()));
    result
}

fn blocks_equal(left: &[Block], right: &[Block]) -> bool {
    left.len() == right.len()
        && left.iter().zip(right).all(|(a, b)| {
            a.name == b.name
                && a.labels == b.labels
                && a.attributes == b.attributes
                && blocks_equal(&a.blocks, &b.blocks)
        })
}

fn documents_equal(left: &Document, right: &Document) -> bool {
    blocks_equal(&left.blocks, &right.blocks)
}

fn patch_capacity(input: &str, slots: usize) -> Result<(String, bool), &'static str> {
    if slots != 1 && slots != 2 {
        return Err("only the reviewed NP1/NP2 profiles are permitted");
    }
    let original = parse(input).map_err(|_| "original ACL syntax is invalid")?;
    let mut candidate = original.clone();
    let replacements = [slots, slots, 8, 1000];
    for (field, value) in FIELDS.iter().zip(replacements) {
        let found: Vec<usize> = candidate
            .blocks
            .iter()
            .enumerate()
            .filter(|(_, block)| block.name == *field)
            .map(|(index, _)| index)
            .collect();
        if found.len() > 1 {
            return Err("duplicate capacity assignment is refused");
        }
        if let Some(index) = found.first() {
            let block = &mut candidate.blocks[*index];
            if !block.labels.is_empty() || !block.blocks.is_empty() || block.attributes.len() != 1 {
                return Err("capacity assignment has an unsupported AST shape");
            }
            match block.attributes.get(*field) {
                Some(Value::Number(number))
                    if number.is_finite() && *number >= 0.0 && number.fract() == 0.0 => {}
                _ => {
                    return Err("capacity assignment must be a finite nonnegative integer literal")
                }
            }
            block
                .attributes
                .insert((*field).to_string(), Value::Number(value as f64));
        } else {
            candidate.blocks.push(Block {
                name: (*field).to_string(),
                labels: Vec::new(),
                blocks: Vec::new(),
                attributes: HashMap::from([((*field).to_string(), Value::Number(value as f64))]),
            });
        }
    }
    if !documents_equal(&without_capacity(&candidate), &without_capacity(&original)) {
        return Err("noncapacity AST changed");
    }
    let generated = generate(&candidate);
    let reparsed = parse(&generated).map_err(|_| "generated ACL syntax is invalid")?;
    if !documents_equal(&reparsed, &candidate)
        || !documents_equal(&without_capacity(&reparsed), &without_capacity(&original))
    {
        return Err("ACL roundtrip changed configuration semantics");
    }
    Ok((generated, true))
}

fn secure_write(path: &Path, bytes: &[u8]) -> Result<(), &'static str> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .map_err(|_| "sealed output already exists or cannot be created")?;
    file.write_all(bytes)
        .map_err(|_| "sealed output write failed")?;
    file.sync_all().map_err(|_| "sealed output sync failed")?;
    Ok(())
}

fn hash(path: &Path) -> Result<String, &'static str> {
    let result = Command::new("sha256sum")
        .arg("--")
        .arg(path)
        .output()
        .map_err(|_| "configuration digest command failed")?;
    if !result.status.success() {
        return Err("configuration digest failed");
    }
    let text = std::str::from_utf8(&result.stdout).map_err(|_| "invalid digest encoding")?;
    let digest = text.split_whitespace().next().ok_or("missing digest")?;
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("invalid digest");
    }
    Ok(digest.to_string())
}

fn checked_transaction(path: &Path) -> Result<PathBuf, &'static str> {
    let canonical = path
        .canonicalize()
        .map_err(|_| "operator must create the sealed transaction directory")?;
    let root = Path::new("/var/lib/a3s-serving-optimization/transactions");
    if !canonical.starts_with(root) || canonical == root || canonical != path {
        return Err("transaction must be a canonical child of the fixed root-only directory");
    }
    // Every ancestor from the sealed root down must be root-owned and private.
    let mut current = Some(canonical.as_path());
    while let Some(directory) = current {
        if !directory.starts_with(root) {
            break;
        }
        let info =
            fs::symlink_metadata(directory).map_err(|_| "sealed directory metadata unavailable")?;
        if !info.is_dir()
            || info.file_type().is_symlink()
            || info.uid() != 0
            || info.permissions().mode() & 0o077 != 0
        {
            return Err("sealed transaction directory must be root-owned and mode0700");
        }
        current = directory.parent();
    }
    Ok(canonical)
}

fn prepare(index: usize, slots: usize, destination: &Path) -> Result<(), &'static str> {
    if unsafe { geteuid() } != 0 {
        return Err("production preparation requires root");
    }
    if index > 7 || (slots != 1 && slots != 2) {
        return Err("profile outside the reviewed closed set");
    }
    if std::env::vars_os().any(|(key, _)| key.to_string_lossy().starts_with("A3S_POWER_")) {
        return Err("validation requires a clean environment without A3S_POWER overrides");
    }
    let destination = checked_transaction(destination)?;
    let source = PathBuf::from(format!("/etc/a3s/power/{index}.acl"));
    let info = fs::symlink_metadata(&source).map_err(|_| "original ACL metadata unavailable")?;
    if !approved_original_metadata(
        info.is_file(),
        info.file_type().is_symlink(),
        info.uid(),
        info.gid(),
        info.permissions().mode(),
        info.len(),
    ) {
        return Err("original ACL must match approved service-owner uid1000/gid1000/private0600 regular-file metadata");
    }
    let mut bytes = Vec::new();
    File::open(&source)
        .map_err(|_| "original ACL cannot be opened")?
        .take(MAX_ACL_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "original ACL read failed")?;
    if bytes.len() as u64 > MAX_ACL_BYTES {
        return Err("original ACL exceeds byte bound");
    }
    let input = std::str::from_utf8(&bytes).map_err(|_| "original ACL is not UTF8")?;
    let (candidate, preserved) = patch_capacity(input, slots)?;
    let original_path = destination.join("power-original.acl");
    let candidate_path = destination.join("power-candidate.acl");
    secure_write(&original_path, &bytes)?;
    secure_write(&candidate_path, candidate.as_bytes())?;
    let config =
        PowerConfig::load_from(candidate_path.to_str().ok_or("invalid candidate path")?)
            .map_err(|_| "candidate fails the real PowerConfig ACL schema or policy validator")?;
    if config.num_parallel != slots
        || config.max_concurrent_requests != slots as u64
        || config.max_queued_requests != 8
        || config.queue_timeout_ms != 1000
    {
        return Err("effective validated capacity differs from the approved profile");
    }
    // Legacy active=0 may be rejected by the new validator. Never require the old
    // invalid field to validate before its expressly authorized replacement.
    let original_accepted =
        PowerConfig::load_from(source.to_str().ok_or("invalid source path")?).is_ok();
    if hash(&source)? != hash(&original_path)? {
        return Err("original ACL changed during preparation");
    }
    let proof = format!(concat!(
        "{{\n  \"schema\": \"a3s.power.capacity-preparation.v1\",\n",
        "  \"gpu_index\": {index},\n  \"slots\": {slots},\n",
        "  \"original_sha256\": \"{original}\",\n  \"candidate_sha256\": \"{candidate}\",\n",
        "  \"original_uid\": {uid},\n  \"original_gid\": {gid},\n  \"original_mode\": {mode},\n",
        "  \"noncapacity_ast_preserved\": {preserved},\n  \"candidate_real_validator_passed\": true,\n",
        "  \"original_new_validator_accepted\": {original_accepted},\n",
        "  \"production_modified\": false,\n  \"credential_exported\": false\n}}\n"),
        index=index, slots=slots, original=hash(&original_path)?, candidate=hash(&candidate_path)?,
        uid=info.uid(), gid=info.gid(), mode=info.permissions().mode() & 0o7777,
        preserved=preserved, original_accepted=original_accepted);
    secure_write(&destination.join("capacity-proof.json"), proof.as_bytes())?;
    println!("prepared sealed ACL candidate; production unchanged; no contents emitted");
    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let result = if args.len() == 5 && args[1] == "prepare" {
        match (args[2].parse::<usize>(), args[3].parse::<usize>()) {
            (Ok(index), Ok(slots)) => prepare(index, slots, Path::new(&args[4])),
            _ => Err("invalid closed profile arguments"),
        }
    } else {
        Err("usage: acl-capacity-prepare prepare INDEX SLOTS /var/lib/a3s-serving-optimization/transactions/TRANSACTION/GPU")
    };
    if let Err(message) = result {
        // Raw ACL/parser/PowerConfig errors may contain secrets. Never print them.
        eprintln!("capacity preparation refused: {message}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn original_metadata_accepts_only_the_verified_private_service_account_file() {
        assert!(approved_original_metadata(
            true, false, 1000, 1000, 0o600, 227
        ));
        for (regular, symlink, uid, gid, mode, length) in [
            (false, false, 1000, 1000, 0o600, 227),
            (true, true, 1000, 1000, 0o600, 227),
            (true, false, 0, 0, 0o600, 227),
            (true, false, 1000, 1001, 0o600, 227),
            (true, false, 1001, 1000, 0o600, 227),
            (true, false, 1000, 1000, 0o640, 227),
            (true, false, 1000, 1000, 0o4600, 227),
            (true, false, 1000, 1000, 0o600, 0),
            (true, false, 1000, 1000, 0o600, MAX_ACL_BYTES + 1),
        ] {
            assert!(!approved_original_metadata(
                regular, symlink, uid, gid, mode, length
            ));
        }
    }

    #[test]
    fn legacy_zero_patches_only_explicit_capacity_and_preserves_nested_auth() {
        let source = "host = \"127.0.0.1\"\napi_keys = [\"synthetic-fixture-secret\"]\nmax_concurrent_requests = 0\ngpu { gpu_layers = 99 }\n";
        let original = parse(source).unwrap();
        let (changed, preserved) = patch_capacity(source, 2).unwrap();
        assert!(preserved);
        let after = parse(&changed).unwrap();
        assert!(documents_equal(
            &without_capacity(&original),
            &without_capacity(&after)
        ));
        for (name, expected) in FIELDS.iter().zip([2.0, 2.0, 8.0, 1000.0]) {
            let block = after
                .blocks
                .iter()
                .find(|block| block.name == *name)
                .unwrap();
            assert_eq!(block.attributes.get(*name), Some(&Value::Number(expected)));
        }
    }

    #[test]
    fn duplicate_or_nested_or_expression_capacity_is_refused() {
        for source in [
            "num_parallel = 1\nnum_parallel = 2\n",
            "num_parallel { value = 1 }\n",
            "num_parallel = \"2\"\n",
        ] {
            assert!(patch_capacity(source, 2).is_err());
        }
    }

    #[test]
    fn noncapacity_unknown_fields_survive_for_real_schema_rejection() {
        let source = "unknown_policy = \"do-not-drop\"\napi_keys = [\"synthetic\"]\n";
        let (changed, _) = patch_capacity(source, 1).unwrap();
        assert!(documents_equal(
            &without_capacity(&parse(source).unwrap()),
            &without_capacity(&parse(&changed).unwrap())
        ));
        assert!(patch_capacity(source, 4).is_err());
    }

    #[test]
    fn generated_candidate_uses_real_power_schema_and_rejects_unknown_policy() {
        // Synthetic host-local fixtures only; no production file or credential.
        for (key, _) in std::env::vars_os() {
            if key.to_string_lossy().starts_with("A3S_POWER_") {
                std::env::remove_var(key);
            }
        }
        let directory =
            std::env::temp_dir().join(format!("power-capacity-fixture-{}", std::process::id()));
        fs::create_dir(&directory).unwrap();
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700)).unwrap();
        let path = directory.join("synthetic.acl");
        let source = "host = \"127.0.0.1\"\ntee_mode = false\napi_keys = [\"synthetic-fixture-only\"]\nmax_concurrent_requests = 0\n";
        secure_write(&path, source.as_bytes()).unwrap();
        assert!(PowerConfig::load_from(path.to_str().unwrap()).is_err());
        fs::remove_file(&path).unwrap();
        let (candidate, _) = patch_capacity(source, 2).unwrap();
        secure_write(&path, candidate.as_bytes()).unwrap();
        let config = PowerConfig::load_from(path.to_str().unwrap()).unwrap();
        assert_eq!(config.num_parallel, 2);
        assert_eq!(config.max_concurrent_requests, 2);
        assert_eq!(config.max_queued_requests, 8);
        assert_eq!(config.queue_timeout_ms, 1000);
        fs::remove_file(&path).unwrap();
        let (invalid, _) =
            patch_capacity(&(source.to_string() + "unknown_policy = true\n"), 2).unwrap();
        secure_write(&path, invalid.as_bytes()).unwrap();
        assert!(PowerConfig::load_from(path.to_str().unwrap()).is_err());
        fs::remove_file(&path).unwrap();
        fs::remove_dir(&directory).unwrap();
    }
}
