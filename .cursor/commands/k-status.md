---
name: k-status
description: Load and run .kstudio/skills/k-status (P15 conductor skill). Immediate.
---

# /k-status

1. **Immediately** Read and follow **`.kstudio/skills/k-status/SKILL.md`** (authoritative).
2. If missing or stale: `python3 .kstudio/workflow/sync-k-skills.py` then retry.
3. Do not write business/product source unless that skill explicitly allows orchestration-only `.kstudio` metadata.
4. P17: do not privately create git branches/worktrees.
