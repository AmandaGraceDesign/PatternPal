---
task: Continued development on merge-test
status: paused — merge verified, merge-test is the active dev branch
last_updated: 2026-05-14 (evening)
current_branch: merge-test
safety_branch: mockup-upgrade (untouched — fallback if needed)
---

## State

**Branches:**
- `merge-test` (HEAD) — verified working. This is the active development branch going forward.
- `mockup-upgrade` — pre-merge snapshot. Leave alone as safety net.
- `origin/main` — unchanged. **Do NOT fast-forward main yet.** User wants a fully working app on `merge-test` before replacing main.

**Today's session:**
- Resumed from `handoff-2026-05-14-merge.md` (the merge from main → mockup-upgrade)
- User confirmed visual QA passed
- Decision: keep building on `merge-test`; do not touch main yet

**Working tree:** clean (only untracked tooling/docs — `.claude/`, `.superpowers/`, `openspec/`, `tasks/`, handoff docs)

**Latest commit:** `15c6248` (merge commit)

## Next action

Resume from this branch when you come back. Pick the next feature/fix to build on `merge-test`. No outstanding bugs from the merge — the app is in a verified working state.

When `merge-test` is "complete enough":
```bash
git checkout main
git merge --ff-only merge-test
# or open a PR if you want a review trail
```

## Carried over (not blockers)

From `handoff-2026-05-14-merge.md`:
- Curtain `physicalWidth: 84` — may want to drop to 70 if gathered panels feel undersized in practice (deferred — only revisit if a user reports issue)

From earlier sessions — see `docs/user-feature-requests.md` for the running feature backlog.

## Don't forget

- Stay on `merge-test`
- Don't push to main, don't fast-forward main
- `mockup-upgrade` is the safety net — don't delete it
