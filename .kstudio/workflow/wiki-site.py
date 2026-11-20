#!/usr/bin/env python3
"""Build project wiki as a KRun-docs-styled static site.

MUST reuse KRun documentation chrome (runtime/docs/assets/styles.css +
docs-header / docs-layout / docs-sidebar / prose / docs-toc / docs-footer).
Do not invent a separate visual theme.

Output: .kstudio/wiki/site/index.html
Prints absolute file:// URL.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import mimetypes
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[2]
KS = ROOT / ".kstudio"
WIKI = KS / "wiki"
OUT = WIKI / "site"
PAGES = OUT / "pages"
ASSETS = OUT / "assets"
VENDOR_ASSETS = Path(__file__).resolve().parent / "wiki-assets"
MAX_SOURCE_BYTES = 1024 * 1024


def md_inline(text: str) -> str:
    # shortcut: a small Markdown subset; use a CommonMark parser if richer syntax is required.
    pattern = r"`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(?<!\*)\*([^*]+)\*(?!\*)"
    result: list[str] = []
    pos = 0
    for match in re.finditer(pattern, text):
        result.append(html.escape(text[pos:match.start()]))
        code, label, href, strong, emphasis = match.groups()
        if code is not None:
            result.append(f"<code>{html.escape(code)}</code>")
        elif href is not None:
            clean = re.sub(r"[\x00-\x20]", "", html.unescape(href))
            try:
                allowed = urlsplit(clean).scheme.lower() in ("", "http", "https", "mailto", "tel")
            except ValueError:
                allowed = False
            result.append(f'<a href="{html.escape(href if allowed else "#", quote=True)}">{md_inline(label)}</a>')
        elif strong is not None:
            result.append(f"<strong>{md_inline(strong)}</strong>")
        else:
            result.append(f"<em>{md_inline(emphasis)}</em>")
        pos = match.end()
    result.append(html.escape(text[pos:]))
    return "".join(result)


def plain_text(markup: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", markup))).strip()


def md_to_html(md: str, page_title: str = "section") -> tuple[str, list[tuple[str, str, int]], str]:
    """Return (html, toc[(id, title, level)], page heading id)."""
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    toc: list[tuple[str, str, int]] = []
    used_ids: set[str] = {"content"}  # The shell owns the skip-link target.
    page_heading_id: str | None = None
    i = 0
    in_code = False
    code_lang = ""
    code_buf: list[str] = []
    list_type: str | None = None

    def allocate_id(label: str) -> str:
        base = re.sub(r"[^\w\-]+", "-", label, flags=re.UNICODE).strip("-").lower() or "section"
        slug = base
        n = 2
        while slug in used_ids:
            slug = f"{base}-{n}"
            n += 1
        used_ids.add(slug)
        return slug

    def close_list() -> None:
        nonlocal list_type
        if list_type:
            out.append(f"</{list_type}>")
            list_type = None

    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            if not in_code:
                close_list()
                in_code = True
                code_lang = line[3:].strip()
                code_buf = []
            else:
                body = html.escape("\n".join(code_buf))
                lang = html.escape(code_lang) if code_lang else ""
                lang_attr = f' data-language="{lang}"' if lang else ""
                out.append(f"<pre{lang_attr} tabindex=\"0\"><code>{body}</code></pre>")
                in_code = False
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if re.match(r"^\s*\|.*\|\s*$", line) and i + 1 < len(lines) and re.match(
            r"^\s*\|?\s*[-:]+", lines[i + 1]
        ):
            close_list()
            rows: list[str] = []
            while i < len(lines) and re.match(r"^\s*\|", lines[i]):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if re.match(r"^[-:\s|]+$", lines[i].replace("|", "")):
                    i += 1
                    continue
                tag = "th" if not rows else "td"
                rows.append(
                    "<tr>"
                    + "".join(f"<{tag}>{md_inline(c)}</{tag}>" for c in cells)
                    + "</tr>"
                )
                i += 1
            thead = rows[0] if rows else ""
            tbody = "".join(rows[1:]) if len(rows) > 1 else ""
            out.append(
                '<div class="table-scroll"><table><thead>'
                + thead
                + "</thead><tbody>"
                + tbody
                + "</tbody></table></div>"
            )
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            close_list()
            level = len(m.group(1))
            raw_title = m.group(2).strip()
            title = md_inline(raw_title)
            label = plain_text(title)
            slug = allocate_id(label)
            if level == 1:
                if page_heading_id is None:
                    page_heading_id = slug
                else:
                    level = 2
            out.append(f'<h{level} id="{html.escape(slug)}">{title}</h{level}>')
            if level in (2, 3):
                toc.append((slug, label, level))
            i += 1
            continue

        if re.match(r"^---+\s*$", line):
            close_list()
            out.append("<hr>")
            i += 1
            continue

        ul = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        ol = re.match(r"^(\s*)\d+\.\s+(.*)$", line)
        if ul or ol:
            kind = "ul" if ul else "ol"
            body = (ul or ol).group(2)
            if list_type != kind:
                close_list()
                list_type = kind
                out.append(f"<{kind}>")
            out.append(f"<li>{md_inline(body)}</li>")
            i += 1
            continue

        if not line.strip():
            close_list()
            i += 1
            continue

        close_list()
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(?:#{1,6}\s|```|---+\s*$|\s*[-*]\s|\s*\d+\.\s|\s*\|)", lines[i]):
            paragraph.append(lines[i])
            i += 1
        out.append("<p>" + "".join(md_inline(part.rstrip()) + ("<br>" if part.endswith("  ") else " ") for part in paragraph).rstrip() + "</p>")

    close_list()
    if in_code:
        out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
    return "\n".join(out), toc, page_heading_id or allocate_id(page_title)


def collect_pages() -> list[dict]:
    pages: list[dict] = []
    if not WIKI.is_dir():
        return pages

    preferred = [
        WIKI / "Home.md",
        WIKI / "README.md",
        WIKI / "Tasks.md",
        WIKI / "Chronicle.md",
        WIKI / "Decisions.md",
    ]
    extras = [p for p in (KS / "workflow" / "GOALS.md", KS / "ENGINEERING.md") if p.is_file()]
    seen: set[Path] = set()

    def add(path: Path, group: str, title: str | None = None) -> None:
        if not path.is_file() or path in seen or path.name.startswith("_"):
            return
        if "site" in path.parts:
            return
        seen.add(path)
        rel = path.relative_to(ROOT).as_posix()
        stem = path.stem
        if path.parent.name == "decisions":
            page_id = f"decisions-{stem}"
            group = "Decisions"
        elif path.parent == KS / "workflow":
            page_id = f"workflow-{stem}"
        elif path.parent == KS:
            page_id = f"kstudio-{stem}"
        else:
            page_id = path.relative_to(WIKI).with_suffix("").as_posix().replace("/", "--").lower()
        pages.append(
            {
                "id": page_id,
                "title": title or stem.replace("-", " "),
                "path": path,
                "rel": rel,
                "group": group,
                "nav_title": {
                    WIKI / "Home.md": "项目概览",
                    WIKI / "README.md": "Wiki 导览",
                    WIKI / "Tasks.md": "任务与产物",
                    WIKI / "Chronicle.md": "项目沿革",
                    WIKI / "Decisions.md": "决策索引",
                    KS / "workflow" / "GOALS.md": "项目目标",
                    KS / "ENGINEERING.md": "AI 工程说明",
                }.get(path),
            }
        )

    for p in preferred:
        add(p, "Decisions" if p.name == "Decisions.md" else "Overview")
    for p in extras:
        add(p, "Project", title=p.stem)
    dec = WIKI / "decisions"
    if dec.is_dir():
        for p in sorted(dec.glob("D*.md")):
            add(p, "Decisions")
    for p in sorted(WIKI.rglob("*.md")):
        add(p, "Overview")
    return pages


def project_path(path: Path) -> Path:
    path = Path(os.path.abspath(path))
    try:
        return ROOT.resolve() / path.relative_to(ROOT.absolute())
    except ValueError:
        return path


def project_resource(path: Path, resources: dict[Path, dict]) -> dict | None:
    root = ROOT.resolve()
    resolved = path.resolve()
    if not path.is_relative_to(root) or not resolved.is_relative_to(root) or resolved.is_relative_to(OUT.resolve()):
        return None
    if path in resources:
        return resources[path]
    relative = path.relative_to(root).as_posix()
    resource = {"path": path, "rel": relative, "title": relative, "nav_title": relative,
                "id": "file-" + hashlib.sha256(relative.encode()).hexdigest()[:16],
                "group": "Files", "kind": "artifact", "anchors": {}, "note": ""}
    resources[path] = resource
    if path.is_dir():
        resource["note"] = "项目目录"
        return resource
    if not path.is_file():
        resource.update(kind="missing", note="不可用：文件不存在")
        return resource
    mime = mimetypes.guess_type(path.name)[0] or ""
    # TypeScript shares the .ts suffix with MPEG transport streams.
    if (mime.startswith(("image/", "audio/", "video/")) and path.suffix.lower() != ".ts") or mime in ("text/html", "application/xhtml+xml", "application/pdf"):
        return resource
    try:
        # shortcut: large text stays at its original URL; raise the cap if large-source browsing is needed.
        if path.stat().st_size > MAX_SOURCE_BYTES:
            resource["note"] = "文件较大，打开原文件"
            return resource
        content = path.read_bytes().decode("utf-8")
        if "\0" not in content:
            resource.update(kind="source", content=content)
    except (OSError, UnicodeDecodeError):
        resource["note"] = "打开原文件"
    return resource


def artifact_path(path: Path) -> Path:
    return OUT / "artifacts" / path.relative_to(ROOT.resolve())


def project_file(path: Path) -> bool:
    resolved = path.resolve()
    root = ROOT.resolve()
    return path.is_relative_to(root) and resolved.is_relative_to(root) and not resolved.is_relative_to(OUT.resolve()) and path.is_file()


def css_dependencies(text: str) -> list[str]:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return [m[2] if m[2] is not None else m[4]
            for m in re.finditer(r'''url\(\s*(["']?)(.*?)\1\s*\)|@import\s+(["'])(.*?)\3''', text, re.S)]


class ArtifactReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: list[str] = []
        self.base: str | None = None
        self.styles: list[str] = []
        self.in_style = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "base" and self.base is None:
            self.base = values.get("href")
        if tag == "link" and set((values.get("rel") or "").lower().split()) & {"stylesheet", "icon", "preload", "modulepreload", "apple-touch-icon", "mask-icon"}:
            if values.get("href"):
                self.urls.append(values["href"])
        for name in {"script": ("src",), "img": ("src",),
                     "source": ("src",), "video": ("src", "poster"), "audio": ("src",),
                     "iframe": ("src",), "object": ("data",), "embed": ("src",),
                     "image": ("href", "xlink:href"), "use": ("href", "xlink:href")}.get(tag, ()):
            if values.get(name):
                self.urls.append(values[name])
        if tag in ("img", "source") and values.get("srcset"):
            self.urls.extend(part.strip().split()[0] for part in values["srcset"].split(",") if part.strip())
        self.urls.extend(css_dependencies(values.get("style") or ""))
        if tag == "style":
            self.in_style = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self.in_style = False
            self.styles.append("\n")

    def handle_data(self, data: str) -> None:
        if self.in_style:
            self.styles.append(data)


def artifact_dependencies(path: Path) -> list[Path]:
    base = path.parent
    if path.suffix.lower() in (".html", ".htm", ".svg"):
        parser = ArtifactReferences()
        with path.open(encoding="utf-8", errors="replace") as stream:
            for chunk in iter(lambda: stream.read(65536), ""):
                parser.feed(chunk)
        parser.close()
        urls = parser.urls + css_dependencies("".join(parser.styles))
        if parser.base:
            try:
                target = urlsplit(parser.base)
            except ValueError:
                return []
            if target.scheme or target.netloc:
                return []
            base = path.parent / unquote(target.path)
            if not target.path.endswith("/"):
                base = base.parent
    elif path.suffix.lower() == ".css":
        urls = css_dependencies(path.read_text(encoding="utf-8", errors="replace"))
    else:
        return []
    dependencies: list[Path] = []
    for href in urls:
        try:
            url = urlsplit(href)
        except ValueError:
            continue
        if not url.scheme and not url.netloc and url.path:
            dependencies.append(Path(os.path.abspath(base / unquote(url.path))))
    return dependencies


def copy_artifacts(paths: list[Path]) -> int:
    destination = OUT / "artifacts"
    if destination.exists():
        shutil.rmtree(destination)
    pending = [(project_path(path), frozenset()) for path in paths]
    copied: set[Path] = set()
    while pending:
        path, ancestors = pending.pop()
        if path in copied or not project_file(path):
            continue
        target = artifact_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        copied.add(path)
        resolved = path.resolve()
        if resolved not in ancestors:
            pending.extend((dependency, ancestors | {resolved}) for dependency in artifact_dependencies(path))
    return len(copied)


def rewrite_md_links(body: str, pages: list[dict], source: Path, at_root: bool,
                     resources: dict[Path, dict] | None = None, references: list[dict] | None = None) -> str:
    by_path = {p["path"].resolve(): p for p in pages}
    output_dir = (OUT if at_root else PAGES).resolve()
    root_id = pages[0]["id"]

    def repl(m: re.Match[str]) -> str:
        if m.group(1):
            return m.group(0)
        label, href = m.group(3), m.group(4)
        try:
            url = urlsplit(href)
        except ValueError:
            return m.group(0)
        if url.scheme or url.netloc or not url.path:
            return m.group(0)
        path = project_path(source.parent / unquote(url.path))
        target = by_path.get(path.resolve())
        if target:
            path = OUT / "index.html" if target["id"] == root_id else PAGES / f"{target['id']}.html"
        resource = None if target or resources is None else project_resource(path, resources)
        note = ""
        fragment = url.fragment
        if resource and resource["kind"] != "missing" and path.is_file():
            path = artifact_path(path)
        if resource and resource["kind"] == "source":
            line = re.fullmatch(r"L([1-9]\d{0,8})(?:-L?([1-9]\d{0,8}))?", unquote(fragment)) if fragment else None
            if not fragment:
                path = PAGES / f"{resource['id']}.html"
            elif line and 1 <= int(line[1]) <= int(line[2] or line[1]) <= max(1, len(resource["content"].splitlines())):
                fragment = unquote(fragment)
                if line[2]:
                    resource["anchors"][fragment] = int(line[1])
                path = PAGES / f"{resource['id']}.html"
            else:
                note = "原文件：未匹配行号锚点"
        relative = quote(os.path.relpath(path.resolve(), output_dir).replace(os.sep, "/"), safe="/.-_")
        href = urlunsplit(('', '', relative, url.query, fragment))
        if resource and references is not None:
            reference = {"resource": resource, "href": href, "label": plain_text(md_inline(label)), "fragment": fragment, "note": note}
            if not any(r["href"] == href for r in references):
                references.append(reference)
        if resource and resource["kind"] == "missing":
            return f'{label}（不可用：`{resource["rel"]}`）'
        return f"[{label}]({href})"

    rewritten: list[str] = []
    fence = ""
    for line in body.splitlines(keepends=True):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if not fence:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = ""
            rewritten.append(line)
        elif fence:
            rewritten.append(line)
        else:
            rewritten.append(re.sub(r"(`+)(.*?)\1|\[([^\]]+)\]\(([^)]+)\)", repl, line))
    return "".join(rewritten)


def resource_references(references: list[dict]) -> str:
    if not references:
        return ""
    entries: list[str] = []
    for reference in references:
        resource = reference["resource"]
        kind = "源文件" if resource["kind"] == "source" else "产物"
        note = reference["note"] or resource["note"] or kind
        target = resource["rel"] + ("#" + reference["fragment"] if reference["fragment"] else "")
        text = f'<strong>{html.escape(reference["label"])}</strong><span>{html.escape(target)} · {html.escape(note)}</span>'
        entries.append(f'<div class="resource-unavailable">{text}</div>' if resource["kind"] == "missing"
                       else f'<a href="{html.escape(reference["href"])}">{text}</a>')
    return '<section class="docs-resources" aria-label="项目文件与产物"><h2 class="nav-label">项目文件与产物</h2><div class="page-sources">' + "".join(entries) + '</div></section>'


def source_view(resource: dict) -> str:
    rows: list[str] = []
    for number, text in enumerate(resource["content"].splitlines() or [""], 1):
        aliases = "".join(f'<span class="source-range-anchor" id="{html.escape(anchor)}" aria-hidden="true"></span>'
                          for anchor, start in resource["anchors"].items() if start == number)
        rows.append(f'<span class="source-code-line" id="L{number}">{aliases}<a class="source-line-number" href="#L{number}" aria-label="第 {number} 行">{number}</a>{html.escape(text)}</span>')
    return '<p>点击行号可链接到该行。页脚可打开原文件。</p><pre class="source-viewer" tabindex="0"><code>' + "".join(rows) + '</code></pre>'


def project_name() -> str:
    man = KS / "MANIFEST.json"
    if man.is_file():
        try:
            return str(json.loads(man.read_text(encoding="utf-8")).get("project") or ROOT.name)
        except Exception:  # noqa: BLE001
            pass
    return ROOT.name


def find_asset_dir() -> Path:
    candidates = [
        ROOT / "runtime" / "docs" / "assets",
        ROOT / "runtime" / "content" / "docs" / "assets",
        VENDOR_ASSETS,
    ]
    for c in candidates:
        if (c / "styles.css").is_file():
            return c
    raise SystemExit(
        "error: KRun docs styles not found "
        "(expected runtime/docs/assets/styles.css or wiki-assets/styles.css)"
    )


def copy_assets() -> None:
    src = find_asset_dir()
    if ASSETS.exists():
        shutil.rmtree(ASSETS)
    ASSETS.mkdir(parents=True)
    for name in ("styles.css", "kense-mark.png", "kense-icon.png"):
        f = src / name
        if f.is_file():
            shutil.copy2(f, ASSETS / name)
    shutil.copy2(VENDOR_ASSETS / "wiki.css", ASSETS / "wiki.css")
    if not (ASSETS / "styles.css").is_file():
        raise SystemExit(f"error: styles.css missing in {src}")


def href_for(pid: str, current_id: str, root_id: str) -> str:
    if current_id == root_id:
        return "index.html" if pid == root_id else f"pages/{pid}.html"
    return "../index.html" if pid == root_id else f"{pid}.html"


def asset_prefix(current_id: str, root_id: str) -> str:
    return "./assets" if current_id == root_id else "../assets"


def build_chapter_nav(pages: list[dict], current_id: str, root_id: str) -> str:
    groups: dict[str, list[dict]] = {}
    for p in pages:
        groups.setdefault(p["group"], []).append(p)
    chunks: list[str] = []
    def link(page: dict) -> str:
        href = href_for(page["id"], current_id, root_id)
        current = ' aria-current="page"' if page["id"] == current_id else ""
        cls = ' class="nav-home"' if page["id"] == root_id else ""
        title = page.get("nav_title") or page["title"]
        match = re.match(r"^(D\d+)\s*[—–-]\s*(.*)$", title)
        label = (f'<span class="nav-id">{html.escape(match[1])}</span> {html.escape(match[2])}'
                 if match else html.escape(title))
        return f'<a{cls} href="{html.escape(href)}" title="{html.escape(page["title"])}"{current}><span>{label}</span></a>'

    for group in ("Overview", "Project", "Decisions"):
        items = groups.get(group, [])
        if not items:
            continue
        label = {"Overview": "项目概览", "Project": "工程与目标", "Decisions": "架构决策"}.get(group, group)
        chunks.append(f'<div class="nav-group"><p class="nav-group-label">{html.escape(label)}</p>')
        if group == "Decisions":
            records = [p for p in items if p["path"].parent.name == "decisions"]
            chunks.extend(link(p) for p in items if p not in records)
            if records:
                opened = " open" if any(p["id"] == current_id for p in records) else ""
                chunks.append(f'<details class="nav-records"{opened}><summary>决策记录 <span class="nav-count">{len(records)}</span></summary>')
                chunks.extend(link(p) for p in records)
                chunks.append("</details>")
        else:
            chunks.extend(link(p) for p in items)
        chunks.append("</div>")
    return "\n".join(chunks)


def build_toc(toc: list[tuple[str, str, int]]) -> str:
    if not toc:
        return '<p class="nav-label">本页</p><nav><span class="source-line">（无二级标题）</span></nav>'
    roots: list[tuple[str, str, list]] = []
    children = None
    for slug, title, level in toc:
        node = (slug, title, [])
        if level == 2 or children is None:
            roots.append(node)
            children = node[2] if level == 2 else None
        else:
            children.append(node)

    def render(items: list) -> str:
        return '<ul>' + ''.join(
            f'<li><a href="#{html.escape(slug)}">{html.escape(title)}</a>{render(sub) if sub else ""}</li>'
            for slug, title, sub in items
        ) + '</ul>'

    return f'<p class="nav-label">本页</p><nav class="toc-outline" aria-label="本页目录">{render(roots)}</nav>'


def page_shell(
    *,
    title: str,
    description: str,
    project: str,
    wordmark: str,
    rel_source: str,
    built_at: str,
    current_id: str,
    root_id: str,
    pages: list[dict],
    body_html: str,
    toc: list[tuple[str, str, int]],
    heading_id: str,
    references_html: str = "",
    prev_p: dict | None,
    next_p: dict | None,
) -> str:
    ap = asset_prefix(current_id, root_id)
    nav = build_chapter_nav(pages, current_id, root_id)
    toc_html = build_toc(toc)
    home_href = href_for(root_id, current_id, root_id)
    current_page = next(p for p in pages if p["id"] == current_id)
    group_label = {"Overview": "项目概览", "Project": "工程与目标", "Decisions": "架构决策", "Files": "项目文件"}.get(current_page["group"], current_page["group"])
    index_page = next((p for p in pages if p["path"] == WIKI / "Decisions.md"), None)
    directory_page = next((p for p in pages if p["path"] == WIKI / "README.md"), index_page)
    directory_link = (f'<a class="download-link" href="{html.escape(href_for(directory_page["id"], current_id, root_id))}">{"目录" if directory_page != index_page else "决策索引"}</a>'
                      if directory_page and directory_page["id"] != root_id else "")
    category = (f'<a href="{html.escape(href_for(index_page["id"], current_id, root_id))}">{group_label}</a>'
                if current_page["group"] == "Decisions" and index_page and index_page["id"] != current_id
                else f'<span>{html.escape(group_label)}</span>')
    decision_id = re.match(r"^(D\d+)\s*[—–-]", title)
    current_label = current_page.get("nav_title") or (decision_id[1] if decision_id else title)
    current_crumb = f'<span aria-current="page" title="{html.escape(title)}" aria-label="{html.escape(title)}">{html.escape(current_label)}</span>'
    breadcrumb = current_crumb if current_label == group_label else f'{category}<span aria-hidden="true">/</span>{current_crumb}'
    original = project_path(ROOT / rel_source)
    original = artifact_path(original) if project_file(original) else original
    source_href = quote(os.path.relpath(original.resolve(), (OUT if current_id == root_id else PAGES).resolve()).replace(os.sep, "/"), safe="/.-_")
    mobile_toc = f'<details class="mobile-navigation page-toc"><summary>本页目录</summary><div class="toc-content">{toc_html}</div></details>' if toc else ""

    nav_prev_next = ""
    if prev_p or next_p:
        left = (
            f'<a href="{html.escape(href_for(prev_p["id"], current_id, root_id))}">'
            f'<span>上一篇</span><strong>{html.escape(prev_p["title"])}</strong></a>'
            if prev_p
            else "<span></span>"
        )
        right = (
            f'<a href="{html.escape(href_for(next_p["id"], current_id, root_id))}">'
            f'<span>下一篇</span><strong>{html.escape(next_p["title"])}</strong></a>'
            if next_p
            else "<span></span>"
        )
        nav_prev_next = f'<nav class="page-navigation" aria-label="相邻章节">{left}{right}</nav>'

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)} · {html.escape(project)} Wiki</title>
  <meta name="description" content="{html.escape(description)}" />
  <link rel="icon" href="{ap}/kense-icon.png" />
  <link rel="stylesheet" href="{ap}/styles.css" />
  <link rel="stylesheet" href="{ap}/wiki.css" />
</head>
<body>
  <a class="skip-link" href="#content">跳到正文</a>
  <header class="docs-header">
    <a class="docs-brand" href="{html.escape(home_href)}">
      <img class="brand-logo" src="{ap}/kense-mark.png" width="28" height="28" alt="Kense" />
      <span>Kense</span>
      <span class="header-divider">/</span>
      <span class="docs-wordmark">{html.escape(wordmark)}</span>
    </a>
    <nav class="header-links" aria-label="站点">
      <a href="{html.escape(home_href)}">Wiki</a>
      {directory_link}
    </nav>
  </header>
  <div class="docs-layout">
    <aside class="docs-sidebar" aria-label="章节">
      <div class="sidebar-heading">
        <img class="sidebar-logo" src="{ap}/kense-mark.png" width="22" height="22" alt="" />
        <div>
          <strong>{html.escape(project)}</strong>
          <span>项目知识 · .kstudio/wiki</span>
        </div>
      </div>
      <nav class="chapter-nav" aria-label="文档目录">
        <p class="nav-label">Wiki</p>
        {nav}
      </nav>
      <div class="docs-version"><span class="version-dot"></span> /wiki · KRun docs style</div>
    </aside>
    <main id="content" tabindex="-1">
      <details class="mobile-navigation">
        <summary>章节导航</summary>
        <nav>{nav}</nav>
      </details>
      <nav class="breadcrumb" aria-label="面包屑">
        <a href="{html.escape(home_href)}">{html.escape(project)}</a><span aria-hidden="true">/</span>
        {breadcrumb}
      </nav>
      <header class="article-heading">
        <p class="eyebrow">PROJECT WIKI</p>
        <h1 id="{html.escape(heading_id)}">{html.escape(title)}</h1>
      </header>
      {mobile_toc}
      <article class="prose">
{body_html}
      </article>
      {references_html}
      {nav_prev_next}
      <footer class="docs-footer">
        <div class="article-meta wiki-provenance">
          <span>来源：<a href="{html.escape(source_href)}"><code>{html.escape(rel_source)}</code></a></span>
          <span>生成：<time datetime="{html.escape(built_at)}">{html.escape(built_at)}</time></span>
          <span>wiki ≠ Pass</span>
        </div>
      </footer>
    </main>
    <aside class="docs-toc" aria-label="本页目录">
      <div class="toc-content">
        {toc_html}
      </div>
    </aside>
  </div>
  <script>
    const menu = document.querySelector('.chapter-nav');
    const current = menu.querySelector('[aria-current="page"]');
    if (current) {{
      const offset = current.getBoundingClientRect().top - menu.getBoundingClientRect().top;
      if (offset < 0 || offset + current.offsetHeight > menu.clientHeight) {{
        menu.scrollTop += offset - menu.clientHeight / 2;
      }}
    }}
  </script>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Build .kstudio/wiki site in KRun docs style")
    ap.parse_args()
    if not WIKI.is_dir():
        print("error: missing .kstudio/wiki/", file=sys.stderr)
        return 2

    pages = collect_pages()
    if not pages:
        print("error: no markdown pages under .kstudio/wiki", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    PAGES.mkdir(parents=True, exist_ok=True)
    for old in PAGES.glob("*.html"):
        old.unlink()
    copy_assets()

    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    proj = project_name()
    wordmark = "Wiki"
    root_id = pages[0]["id"]

    # refine titles from H1
    for p in pages:
        raw = p["path"].read_text(encoding="utf-8")
        hm = re.search(r"^#\s+(.+)$", raw, re.M)
        if hm:
            p["title"] = plain_text(md_inline(hm.group(1).strip()))
        p["_raw"] = raw

    resources: dict[Path, dict] = {}
    for idx, p in enumerate(pages):
        references: list[dict] = []
        raw = rewrite_md_links(p["_raw"], pages, p["path"], idx == 0, resources, references)
        body_html, toc, heading_id = md_to_html(raw, p["title"])
        # drop duplicate H1 inside prose (already in article-heading)
        body_html = re.sub(r"<h1[^>]*>.*?</h1>\s*", "", body_html, count=1, flags=re.S)
        desc_m = re.search(r"<p>(.*?)</p>", body_html, re.S)
        description = plain_text(desc_m.group(1))[:160] if desc_m else p["title"]
        siblings = [candidate for candidate in pages if candidate["group"] == p["group"]]
        position = siblings.index(p)
        prev_p = siblings[position - 1] if position else None
        next_p = siblings[position + 1] if position + 1 < len(siblings) else None
        doc = page_shell(
            title=p["title"],
            description=description,
            project=proj,
            wordmark=wordmark,
            rel_source=p["rel"],
            built_at=built_at,
            current_id=p["id"],
            root_id=root_id,
            pages=pages,
            body_html=body_html,
            toc=toc,
            heading_id=heading_id,
            references_html=resource_references(references),
            prev_p=prev_p,
            next_p=next_p,
        )
        if idx == 0:
            (OUT / "index.html").write_text(doc, encoding="utf-8")
            # Keep old root-page links working at the canonical URL, including fragments.
            doc = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=../index.html"><title>文档首页</title>
<script>location.replace('../index.html' + location.hash);</script></head>
<body><a href="../index.html">打开文档首页</a></body></html>'''
        (PAGES / f"{p['id']}.html").write_text(doc, encoding="utf-8")

    sources = [resource for resource in resources.values() if resource["kind"] == "source"]
    for resource in sources:
        doc = page_shell(title=resource["title"], description="项目源文件：" + resource["rel"],
                         project=proj, wordmark=wordmark, rel_source=resource["rel"], built_at=built_at,
                         current_id=resource["id"], root_id=root_id, pages=pages + [resource],
                         body_html=source_view(resource), toc=[], heading_id="source-file",
                         prev_p=None, next_p=None)
        (PAGES / f"{resource['id']}.html").write_text(doc, encoding="utf-8")

    copied = copy_artifacts([p["path"] for p in pages] + [resource["path"] for resource in resources.values()])

    index = (OUT / "index.html").resolve()
    print("=== wiki site built (KRun docs style) ===")
    print(f"assets: {find_asset_dir()}")
    print(f"pages: {len(pages)}")
    print(f"source viewers: {len(sources)}")
    print(f"packaged files: {copied}")
    print(f"out: {index}")
    print(f"open: {index.as_uri()}")
    print("tip: open the file URL in a browser (macOS: open <path>)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
