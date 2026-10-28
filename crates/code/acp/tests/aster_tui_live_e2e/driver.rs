#![cfg(test)]

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc::{channel, Receiver};
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde_json::{json, Value};

pub(super) struct LiveTui {
    _root: tempfile::TempDir,
    pub workspace: PathBuf,
    pub home: PathBuf,
    config: PathBuf,
    config_before: Vec<u8>,
    binary: PathBuf,
    pub editor: Option<String>,
    session: Option<String>,
    secrets: Vec<String>,
    child: Option<Box<dyn Child + Send + Sync>>,
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Option<Box<dyn Write + Send>>,
    rx: Option<Receiver<Vec<u8>>>,
    parser: vt100::Parser,
    raw: Vec<u8>,
    cpr_through: usize,
    case: String,
    evidence: Vec<Value>,
    finished: bool,
}

impl LiveTui {
    pub fn new(case: &str) -> Self {
        let config = PathBuf::from(
            std::env::var_os("A3S_CONFIG_FILE")
                .expect("A3S_CONFIG_FILE is required; no skipped live observations"),
        );
        let config = config.canonicalize().expect("explicit host ACL exists");
        let parsed = a3s_code_core::CodeConfig::from_file(&config)
            .unwrap_or_else(|_| panic!("explicit host ACL could not be parsed"));
        assert_eq!(parsed.default_model.as_deref(), Some("kimi/k3.1-pro"));
        let mut secrets = Vec::new();
        for provider in &parsed.providers {
            secrets.extend(provider.api_key.iter().cloned());
            secrets.extend(provider.base_url.iter().cloned());
            secrets.extend(provider.headers.values().cloned());
            for model in &provider.models {
                secrets.extend(model.api_key.iter().cloned());
                secrets.extend(model.headers.values().cloned());
            }
        }
        let root = if cfg!(windows) {
            let base =
                PathBuf::from(std::env::var_os("SystemRoot").expect("SystemRoot")).join("Temp");
            tempfile::Builder::new()
                .prefix("aster-kimi-")
                .tempdir_in(base)
                .unwrap()
        } else {
            tempfile::Builder::new()
                .prefix("aster-kimi-")
                .tempdir()
                .unwrap()
        };
        let home = root.path().join("home");
        let workspace = root.path().join("workspace");
        for dir in [
            &workspace,
            &home.join("grok"),
            &home.join("AppData/Local"),
            &home.join("AppData/Roaming"),
        ] {
            std::fs::create_dir_all(dir).unwrap();
        }
        let companion = PathBuf::from(
            std::env::var_os("A3S_CODE_ACP_BIN")
                .unwrap_or_else(|| env!("CARGO_BIN_EXE_a3s-code-acp").into()),
        );
        let binary = std::env::var_os("A3S_CODE_TUI_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                companion.with_file_name(format!("aster{}", std::env::consts::EXE_SUFFIX))
            });
        assert!(
            binary.is_file() && companion.is_file(),
            "build the source pair first"
        );
        let build_id = |path: &Path| {
            let out = Command::new(path).arg("--build-id").output().unwrap();
            assert!(out.status.success());
            String::from_utf8(out.stdout).unwrap().trim().to_string()
        };
        let tui_id = build_id(&binary);
        assert_eq!(
            tui_id,
            build_id(&companion),
            "TUI and ACP source identities differ"
        );
        let mut value = Self {
            config_before: std::fs::read(&config).unwrap(),
            _root: root,
            workspace,
            home,
            config,
            binary,
            editor: None,
            session: None,
            secrets,
            child: None,
            master: None,
            writer: None,
            rx: None,
            parser: vt100::Parser::new(40, 120, 2000),
            raw: Vec::new(),
            cpr_through: 0,
            case: case.into(),
            evidence: Vec::new(),
            finished: false,
        };
        value.record("source-pair", &tui_id);
        value
    }

    pub fn launch(&mut self, args: &[&str]) {
        assert!(self.child.is_none());
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 40,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut command = CommandBuilder::new(&self.binary);
        command.args(["--cwd", self.workspace.to_str().unwrap(), "--no-plan"]);
        command.args(args);
        command.cwd(&self.workspace);
        command.env_clear();
        // Carry only OS execution dependencies, never ambient provider/account state.
        for key in [
            "PATH",
            "SystemRoot",
            "WINDIR",
            "COMSPEC",
            "PATHEXT",
            "ProgramFiles",
            "ProgramFiles(x86)",
            "ProgramData",
            "TEMP",
            "TMP",
        ] {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        command.env("HOME", &self.home);
        command.env("USERPROFILE", &self.home);
        command.env("APPDATA", self.home.join("AppData/Roaming"));
        command.env("LOCALAPPDATA", self.home.join("AppData/Local"));
        command.env("GROK_HOME", self.home.join("grok"));
        command.env("A3S_CONFIG", &self.config);
        command.env("A3S_DISABLE_CC_SWITCH", "1");
        command.env("A3S_DISABLE_GROK_ACCOUNT", "1");
        command.env("A3S_DISABLE_CURSOR_ACCOUNT", "1");
        command.env("TERM", "xterm-256color");
        if let Some(editor) = &self.editor {
            command.env("EDITOR", editor);
            command.env("VISUAL", editor);
        }
        self.child = Some(pair.slave.spawn_command(command).unwrap());
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        self.writer = Some(pair.master.take_writer().unwrap());
        self.master = Some(pair.master);
        let (tx, rx) = channel();
        std::thread::spawn(move || {
            let mut buffer = [0_u8; 8192];
            while let Ok(n) = reader.read(&mut buffer) {
                if n == 0 || tx.send(buffer[..n].to_vec()).is_err() {
                    break;
                }
            }
        });
        self.rx = Some(rx);
        self.parser = vt100::Parser::new(40, 120, 2000);
        self.raw.clear();
        self.cpr_through = 0;
        self.session = None;
    }

    pub fn bytes(&mut self, bytes: &[u8]) {
        let writer = self.writer.as_mut().unwrap();
        writer.write_all(bytes).unwrap();
        writer.flush().unwrap();
    }

    pub fn screen(&mut self) -> String {
        while let Ok(bytes) = self.rx.as_ref().unwrap().try_recv() {
            self.parser.process(&bytes);
            self.raw.extend_from_slice(&bytes);
        }
        if self.raw[self.cpr_through..]
            .windows(4)
            .any(|w| w == b"\x1b[6n")
        {
            self.cpr_through = self.raw.len();
            self.bytes(b"\x1b[12;1R");
        }
        let screen = self.parser.screen().contents();
        self.redact(&screen)
    }

    pub fn redact(&self, text: &str) -> String {
        let mut out = text.to_string();
        for secret in self.secrets.iter().filter(|secret| secret.len() >= 6) {
            out = out.replace(secret, "[redacted]");
        }
        out
    }

    pub fn pump(&mut self, millis: u64) -> String {
        let deadline = Instant::now() + Duration::from_millis(millis);
        while Instant::now() < deadline {
            self.screen();
            std::thread::sleep(Duration::from_millis(25));
        }
        self.screen()
    }

    pub fn wait_for(&mut self, needle: &str, seconds: u64) -> String {
        let deadline = Instant::now() + Duration::from_secs(seconds);
        let mut last = String::new();
        while Instant::now() < deadline {
            last = self.screen();
            if last.contains("Do you trust the contents of this directory") {
                self.bytes(b"y");
                self.pump(300);
                continue;
            }
            if last.contains(needle) {
                return last;
            }
            assert!(
                self.child.as_mut().unwrap().try_wait().unwrap().is_none(),
                "TUI exited\n{last}"
            );
            std::thread::sleep(Duration::from_millis(40));
        }
        panic!("timeout waiting for {needle:?}\n{last}");
    }

    pub fn dismiss(&mut self) {
        self.bytes(b"\x1b");
        self.pump(700);
        self.focus_composer();
    }

    fn focus_composer(&mut self) {
        if cfg!(unix) {
            // Wait for rendered input before clearing it: an async focus change
            // can otherwise leave the focus key behind or coalesce Enter into a paste.
            const MARKER: &str = "TUI_INPUT_BARRIER";
            self.bytes(b" ");
            self.pump(100);
            self.bytes(b"\x1b[200~TUI_INPUT_BARRIER\x1b[201~");
            self.wait_for(MARKER, 8);
            self.bytes(b"\x05\x15");
            let deadline = Instant::now() + Duration::from_secs(8);
            while self.pump(80).contains(MARKER) {
                assert!(Instant::now() < deadline, "composer input did not clear");
            }
        } else {
            self.bytes(b"i");
            self.pump(100);
            self.bytes(b"\x15");
            self.pump(100);
        }
    }

    pub fn command(&mut self, text: &str) {
        self.focus_composer();
        self.bytes(b"\x1b[200~");
        self.bytes(text.as_bytes());
        self.bytes(b"\x1b[201~");
        let prefix: String = text.chars().take(48).collect();
        self.wait_for(&prefix, 8);
        self.bytes(b"\r");
    }

    pub fn literal_command(&mut self, text: &str) {
        self.focus_composer();
        self.bytes(b"\x1b[200~");
        self.bytes(text.as_bytes());
        self.bytes(b"\x1b[201~");
        self.wait_for(text, 8);
        self.bytes(b"\x1b");
        let armed = self.pump(700);
        assert!(
            armed.contains(text),
            "literal command changed before submission\n{armed}"
        );
        self.bytes(b"\r");
        self.pump(300);
    }

    pub fn resize(&mut self, rows: u16, cols: u16) {
        self.master
            .as_ref()
            .unwrap()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        self.parser.set_size(rows, cols);
        self.pump(600);
    }

    pub fn mouse_modes(&self) -> usize {
        [
            b"\x1b[?1000h".as_slice(),
            b"\x1b[?1000l",
            b"\x1b[?1002h",
            b"\x1b[?1002l",
            b"\x1b[?1006h",
            b"\x1b[?1006l",
        ]
        .iter()
        .map(|code| self.raw.windows(code.len()).filter(|w| w == code).count())
        .sum()
    }

    pub fn preferences(&self) -> String {
        [
            self.home.join("grok/config.toml"),
            self.home.join(".grok/config.toml"),
        ]
        .iter()
        .filter_map(|path| std::fs::read_to_string(path).ok())
        .collect::<Vec<_>>()
        .join("\n")
    }

    pub fn wait_preference(&mut self, text: &str) {
        let deadline = Instant::now() + Duration::from_secs(8);
        while !self.preferences().contains(text) {
            self.pump(100);
            assert!(
                Instant::now() < deadline,
                "preference was not persisted: {text}"
            );
        }
    }

    pub fn wait_fact(&mut self, kind: &str, before: usize) -> Value {
        let deadline = Instant::now() + Duration::from_secs(90);
        loop {
            self.pump(80);
            if let Some(fact) = self
                .facts()
                .into_iter()
                .skip(before)
                .find(|f| f["type"] == kind)
            {
                return fact;
            }
            assert!(
                Instant::now() < deadline,
                "missing fact {kind}\n{}",
                self.screen()
            );
        }
    }

    pub fn session_id(&mut self) -> String {
        self.command("/session-info");
        let info = self.wait_for("Session ID", 30);
        let mut rows = info.lines();
        while let Some(row) = rows.next() {
            if !row.contains("Session ID") {
                continue;
            }
            for line in [row, rows.next().unwrap_or_default()] {
                for token in line.split_whitespace() {
                    if uuid::Uuid::parse_str(token).is_ok() {
                        self.session = Some(token.to_string());
                        return token.to_string();
                    }
                }
            }
        }
        panic!("session-info omitted session id\n{info}");
    }

    pub fn files(&self, dir: &Path, extension: &str) -> Vec<PathBuf> {
        fn walk(dir: &Path, extension: &str, depth: usize, out: &mut Vec<PathBuf>) {
            if depth > 10 {
                return;
            }
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        walk(&path, extension, depth + 1, out);
                    } else if path.extension().and_then(|v| v.to_str()) == Some(extension) {
                        out.push(path);
                    }
                }
            }
        }
        let mut paths = Vec::new();
        walk(dir, extension, 0, &mut paths);
        paths
    }

    pub fn facts(&self) -> Vec<Value> {
        let mut out = Vec::new();
        for path in self.files(&self.workspace.join(".a3s"), "jsonl") {
            if self
                .session
                .as_deref()
                .is_some_and(|id| path.file_stem().and_then(|p| p.to_str()) != Some(id))
            {
                continue;
            }
            if let Ok(text) = std::fs::read_to_string(path) {
                out.extend(
                    text.lines()
                        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
                        .filter(|f| f.get("type").is_some() && f.get("seq").is_some()),
                );
            }
        }
        out
    }

    pub fn assistant_text(&self, facts: &[Value]) -> String {
        facts
            .iter()
            .filter(|f| f["type"] == "model.turn")
            .filter_map(|f| f["payload"]["text"].as_str())
            .collect::<Vec<_>>()
            .join("\n")
    }

    pub fn turn(&mut self, prompt: &str, permission: Option<&[u8]>) -> Vec<Value> {
        if self.session.is_none() {
            self.session_id();
            self.dismiss();
        }
        let before = self.facts().len();
        self.command(prompt);
        let deadline = Instant::now() + Duration::from_secs(420);
        let mut answered = false;
        loop {
            let screen = self.pump(80);
            if !screen.contains("Yes, proceed") {
                answered = false;
            }
            if screen.contains("Yes, proceed") && !answered {
                if let Some(answer) = permission {
                    self.bytes(answer);
                    answered = true;
                    self.record("permission-answer", "answered a real permission card");
                } else {
                    panic!("unexpected permission card\n{screen}");
                }
            }
            let facts = self.facts();
            let delta = facts.get(before..).unwrap_or_default();
            if delta.iter().any(|f| f["type"] == "turn.complete") {
                let observed = delta.to_vec();
                let submitted = observed
                    .iter()
                    .filter(|f| f["type"] == "user.message")
                    .filter_map(|f| f["payload"]["text"].as_str())
                    .collect::<Vec<_>>();
                assert_eq!(
                    submitted,
                    vec![prompt],
                    "submitted prompt bytes differ from the fixed test input"
                );
                let idle_deadline = Instant::now() + Duration::from_secs(15);
                let screen = loop {
                    let screen = self.pump(80);
                    if !screen.contains("[stop]") && !screen.contains("Ctrl+c:cancel") {
                        break screen;
                    }
                    assert!(
                        Instant::now() < idle_deadline,
                        "TUI did not become idle after the terminal fact\n{screen}"
                    );
                };
                assert!(
                    !screen.contains("Turn failed"),
                    "live turn failed\n{screen}"
                );
                self.record(
                    "settled-turn",
                    &format!(
                        "facts={} model_turns={} prompt_tokens={}",
                        observed.len(),
                        observed
                            .iter()
                            .filter(|f| f["type"] == "model.turn")
                            .count(),
                        observed
                            .iter()
                            .filter_map(|f| f["payload"]["prompt_tokens"].as_u64())
                            .sum::<u64>()
                    ),
                );
                return observed;
            }
            assert!(
                Instant::now() < deadline,
                "live turn did not settle\n{screen}"
            );
            assert!(
                !screen.contains("Connection failed") && !screen.contains("Request failed"),
                "provider failure\n{screen}"
            );
        }
    }

    pub fn record(&mut self, name: &str, detail: &str) {
        eprintln!(
            "ORACLE case={} name={name} result=pass detail={detail}",
            self.case
        );
        let screen = self.rx.as_ref().map(|_| ()).map(|_| self.screen());
        self.evidence
            .push(json!({"name":name,"detail":detail,"screen":screen}));
    }

    pub fn quit(&mut self) {
        self.command("/quit");
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            self.pump(60);
            if let Some(status) = self.child.as_mut().unwrap().try_wait().unwrap() {
                assert!(status.success(), "quit status {status:?}");
                break;
            }
            assert!(Instant::now() < deadline, "/quit did not exit");
        }
        self.child = None;
        self.master = None;
        self.writer = None;
        self.rx = None;
        self.record("quit", "exit 0");
    }

    pub fn finish(&mut self) {
        assert!(
            std::fs::read(&self.config).unwrap() == self.config_before,
            "operator ACL changed"
        );
        self.finished = true;
    }
}

impl Drop for LiveTui {
    fn drop(&mut self) {
        let screen = if self.rx.is_some() {
            self.screen()
        } else {
            String::new()
        };
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        if let Some(dir) = std::env::var_os("A3S_TUI_LIVE_EVIDENCE_DIR") {
            let dir = PathBuf::from(dir);
            std::fs::create_dir_all(&dir).unwrap();
            let facts: Vec<Value> = self.facts().iter().filter_map(|fact| {
                let p = &fact["payload"];
                let payload = match fact["type"].as_str()? {
                    "tool.prepared" => json!({"identity":p["prepared"]["identity"], "tool":p["prepared"]["tool_name"]}),
                    "tool.result" => {
                        let r = &p["receipt"];
                        json!({"identity":r["identity"],"prepared_digest":r["prepared_digest"],"outcome":r["outcome"],"effects":r["effects"],"output":r["output"]})
                    }
                    "model.turn" => json!({"prompt_tokens":p["prompt_tokens"],"has_text":p["text"].as_str().is_some_and(|v| !v.is_empty()),"tool":p["call"]["name"]}),
                    "turn.complete" | "a3s.goal.created" | "a3s.goal.paused" | "a3s.goal.resumed" | "a3s.goal.cancelled" | "compaction.done" => p.clone(),
                    _ => return None,
                };
                Some(json!({"seq":fact["seq"],"type":fact["type"],"payload":payload}))
            }).collect();
            let report = json!({"case":self.case,"model":"kimi/k3.1-pro",
                "assertions_finished":self.finished,"panicked":std::thread::panicking(),
                "oracles":self.evidence,"last_screen":screen,"facts":facts,
                "config_unchanged":std::fs::read(&self.config).ok().as_deref()==Some(self.config_before.as_slice())});
            let report = self.redact(&serde_json::to_string_pretty(&report).unwrap());
            std::fs::write(dir.join(format!("{}.json", self.case)), report).unwrap();
        }
    }
}
