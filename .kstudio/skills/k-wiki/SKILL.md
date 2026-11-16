---
name: k-wiki
description: >-
  Organizes and refreshes project DeepWiki-style knowledge under .kstudio/wiki,
  builds a local static HTML site, and gives the user a file:// URL to open.
  Use when the user runs /k-wiki, or asks for wiki site, DeepWiki, 文档站,
  整理 wiki, or an openable HTML docs address. Does not write business app source.
---

# k-wiki

Project entry: when loaded from a global/factory location, read `<repo>/.kstudio/skills/k-wiki/SKILL.md` once if present; when already reading project authority, continue below. If absent, report missing engineering tools/evidence and point to `/k-init`; continue authorized read-only analysis where possible without silently initializing the project.

Slash: **`/k-wiki`**  
Norm: product `docs/conductor-skills.md` (P15) · seat flavor **D**（项目知识）· wiki ≠ Pass.  
Helper: `python3 .kstudio/workflow/wiki-site.py`

## Stance (MUST)

1. Keep **authoritative narrative** in `.kstudio/wiki/` (Home / Tasks / Chronicle / Decisions / ADR).  
2. Auto-**organize & refresh** wiki so it matches HEAD / GOALS / recent decisions — do not invent Pass.  
3. Build a **local static site** and give the user a **directly openable** `file://…/index.html` address.  
4. **Style MUST align with the KRun docs site** (`runtime/docs/assets/styles.css` + same chrome: `docs-header` / `docs-layout` / `docs-sidebar` / `prose` / `docs-toc` / `docs-footer`). MUST NOT invent a separate theme (no dark-only custom skin).  
5. MAY edit `.kstudio/wiki/**` and run the site builder. MUST NOT rewrite business `src/` / product app code.  
6. Wiki explains *why*; lineage/evidence remain gate truth.

## Documentation acceptance (MUST)

- Preserve the original white KRun three-column chrome, base typography, colors, and spacing. Refine menu and content hierarchy using the same components; do not introduce a new theme or search interface.
- Group navigation by purpose and use concise menu labels without changing full article H1 titles. Keep real decision IDs (`D####`), remove meaningless global page numbering, and use native collapsible groups with the current page's group open. Clearly mark the current page and provide meaningful breadcrumbs.
- Use one H1 per page, an H2/H3 page outline, and unique, linkable heading anchors. Preserve keyboard focus and the skip-to-content link.
- Do not repeat the first paragraph as an automatic summary. Keep source/build provenance in the footer. Preserve code examples when rendering or rewriting links.
- Resolve links under `file://` from both `index.html` and nested `pages/*.html`; test generated targets and heading fragments. After generator changes, run focused regression tests and verify desktop/narrow-screen menus, links, and keyboard navigation in a browser. Compare the generated page with the original KRun screenshot to confirm its visual style is retained. Report unavailable browser checks.

Keep `wiki-assets/` complete when copying the builder; reuse the existing KRun `styles.css` and assets. Small wiki-specific CSS overrides may refine menus and content hierarchy; copy them even when the base stylesheet comes from `runtime/docs/assets/`.

## Project references (MUST)

- Support meaningful technical claims with links to actual project files or artifacts. Resolve each path relative to its source Markdown file; use verified `#Lx` or `#Lx-Ly` fragments for code references.
- Open referenced project text in a readable local source viewer with line anchors. Save site-local copies of explicitly cited project originals and their necessary local HTML/CSS/image/script resources, so reports, images, PDFs, and raw source open within the site under `file://`. Retain their real repository-relative path identifiers; list only resources actually cited by the page.
- Check that targets exist and remain inside the project; report missing or out-of-bounds references without fabricating content. Do not follow outside-project symlinks or copy the whole repository. Do not invent line evidence, test results, or Pass; an evidence index or historical report is not a new acceptance result.
- Keep references static and usable under `file://`; no whole-repository scan, server, search service, or remote integration is required. Preserve code examples and commands verbatim when rewriting links.

## Completed tasks (MUST)

- Keep `.kstudio/wiki/Tasks.md` as the human-readable task ledger: one H2 per stable `Tdate-slug` task ID, completion date, specific finished result, clickable actual artifacts, and validation evidence/limitations. Put new completions first and retain history.
- Before the final completion report, a lone executor may record its task; during parallel work, the assigned ledger writer (D/O or another named seat) consolidates real executor reports. Avoid concurrent writes. D/O may backfill only from verified receipts and artifacts; insufficient evidence stays partial/unverified, not completed.
- Keep each task's acceptance evidence at a distinct task-specific path. Do not overwrite an earlier task's acceptance report. Current source links may evolve; receipts and snapshots define historical conclusions.
- Refresh and link the ledger, then package its cited artifacts with the site. Do not invent a new task engine, JSON store, or background process.

## Steps (MUST)

1. Context:

```bash
python3 .kstudio/workflow/sitrep.py
test -f .kstudio/workflow/GOALS.md && head -n 40 .kstudio/workflow/GOALS.md
ls .kstudio/wiki
```

2. **Organize / update wiki markdown** (as needed):  
   - `Home.md` — bird’s-eye aligned to current `workflow/HEAD` + overall goal  
   - `Tasks.md` — retain completed tasks, actual artifacts, and validation under the rules above  
   - `Decisions.md` — index complete for `decisions/D*.md`  
   - `Chronicle.md` — append only if a real wave/control-plane change happened this session  
   - Fix broken relative links inside `.kstudio/wiki`  
   - Do **not** delete historical ADR bodies  

3. **Build site:**

```bash
python3 .kstudio/workflow/wiki-site.py
```

4. **Verify:** check visual consistency, anchors, relative links, and cited source/artifact targets against the acceptance rules above, including a real PNG and an HTML artifact with local styles. For generator changes in this repository, run `python3 scripts/test_wiki_site.py` before browser checks.

5. Reply TTY-style with:  
   - what wiki files changed (brief)  
   - **可打开地址：** absolute `file://…/ .kstudio/wiki/site/index.html` (copy-paste ready)  
   - optional macOS: `open <absolute-path-to-index.html>`  
6. State: wiki site **≠ Pass** / ≠ `/k-progress` %.

## Not this skill

- Wave sitrep → `/k-status`  
- Completion % → `/k-progress`  
- Set overall goals → `/k-goal`  
- Cleanup junk → `/k-clean`
