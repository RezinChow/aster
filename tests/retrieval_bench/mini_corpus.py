"""The synthetic mini-corpus: three files, frozen, with graded labels.

Engine-agnostic: the labels name stable chunk keys (file:startline) so any
retrieval implementation can be scored against them.
"""

import json
from pathlib import Path

# (file, content) — line-900 hit exercises the bounded-snippet property.
FILES = {
    "widget.rs": "\n".join(
        [
            "pub struct Widget {",
            "    pub id: u64,",
            "}",
            "",
            "impl Widget {",
            "    pub fn new(id: u64) -> Self { Self { id } }",
            "}",
        ]
    ),
    "renderer.rs": "\n".join(
        ["pub mod renderer {"] + [f"// filler line {i}" for i in range(1, 900)]
        + [
            "",
            "/// The secret paint routine: paints the widget twice to avoid flicker.",
            "pub fn paint_widget_twice(w: &Widget) { draw(w); draw(w); }",
            "}",
        ]
    ),
    "README.md": "\n".join(
        [
            "# Mini corpus",
            "",
            "The renderer avoids flicker by painting widgets twice.",
        ]
    ),
}

# query id -> {category, query, grades {chunk: 0..3}}
QUERIES = {
    "symbol_lookup": {
        "category": "symbol",
        "query": "Widget new constructor",
        "grades": {"widget.rs:1": 3, "widget.rs:6": 2},
    },
    "semantic_behavior": {
        "category": "semantic",
        "query": "how does the renderer avoid flicker",
        "grades": {"renderer.rs:903": 3, "README.md:3": 2},
    },
    "architecture": {
        "category": "architecture",
        "query": "what module owns widget drawing",
        "grades": {"renderer.rs:1": 3, "renderer.rs:903": 1},
    },
}

EXPECTED_FLOOR = {
    # exact identifier must rank first on symbol queries — the never-regress gate
    "symbol_lookup.lexical_ndcg@10": 1.0,
}


def write_corpus(root: Path) -> None:
    for name, content in FILES.items():
        (root / name).write_text(content, encoding="utf-8")


def labels() -> dict:
    return QUERIES
