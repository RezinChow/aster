# SeeCode 0.6.2

Original skill source from https://github.com/Aryanutkarsh/SeeCode, retrieved 2026-10-28.
Revision recorded in the Git archive ZIP comment: `bf91328450796dcb87f49fb2f37a8acd85d87c52`.
Archive: `https://codeload.github.com/Aryanutkarsh/SeeCode/zip/refs/heads/main`.
Archive SHA-256: `40b0d7b9839e58281e59507ba3b816ddb7dcf206a23a175b15c1634c7c8def8f`.
The skill directory is preserved without source modifications. Its MIT license is in `LICENSE`.

Aster calls `renderSpec` at build time. `scripts/docs_atlas.mjs` extracts the resulting SVG and generated style declarations. It retains the upstream motion stylesheet for requested trace, reveal and exploded animations. Aster supplies progressive controls through its existing external script. It does not embed SeeCode's standalone HTML viewer, external fonts or inline scripts.

Drawing specifications and Chinese explanations are authored for Aster. SeeCode's watermark is retained. Code Hike 1.1.0 is separately pinned in the website package lock and is used to highlight real source excerpts at build time.
