# bmad-tools

A Claude Code plugin pack for BMAD-Swarm projects. Bundles seven skills under the `/bmad-tools:*` namespace plus two hooks that close the highest-friction gaps in the BMAD workflow:

- artifact validation (skill + hook)
- project status dashboard
- complexity scoring
- post-epic lessons extraction
- decision-log auditing (skill + opt-in hook)
- whole-tree schema drift audit (**new in 0.2.0**)
- story migration to documented schema (**new in 0.2.0**)

Local-first. Marketplace distribution is future work.

**Current version**: `0.2.0`

## What's new in 0.2.0

- **Validator hook ships in `advisory` mode by default.** Schema drift now produces a stderr warning and an `allow` decision (exit 1) rather than a hard deny (exit 2). Opt into the v0.1.0 strict-deny behavior via plugin config (see [Hooks](#hooks)).
- **`## Goal` is accepted as a legacy alias for `## User Story`** in story validation.
- **D-ID regex updated** in `audit-decisions` skill, `audit-decisions` hook, and `project-status` skill. Now matches subdomain IDs like `D-BRN-1` and rejects documentation placeholders like `D-ID`, `D-N`, `D-NNN`.
- **`project-status` recognizes additional artifact roles**: `*plan*.md` files count as PRD-equivalent and `adr-*.md` files count as architecture-equivalent. Stories without an explicit `## Status:` line now fall back to a filename heuristic and a git-history scan before being bucketed as `unknown`.
- **`extract-lessons` falls back to scanning all `artifacts/reviews/*.md`** when the input matches no files (or is empty).
- **New skill `schema-doctor`**: whole-tree drift audit. Read-only.
- **New skill `migrate-stories`**: rewrites legacy stories into the documented schema. Default dry-run; `--apply` writes.

## Layout

```
plugins/bmad-tools/
├── .claude-plugin/plugin.json    # version: 0.2.0; config.validatorMode: "advisory"
├── README.md
├── skills/
│   ├── validate-artifact/SKILL.md
│   ├── project-status/SKILL.md
│   ├── score-complexity/SKILL.md
│   ├── extract-lessons/SKILL.md
│   ├── audit-decisions/SKILL.md
│   ├── schema-doctor/SKILL.md      # NEW in 0.2.0
│   └── migrate-stories/SKILL.md    # NEW in 0.2.0
└── hooks/
    ├── hooks.json
    ├── validate-artifact.cjs   # ON by default (PreToolUse on Write); advisory by default
    └── audit-decisions.cjs     # OFF by default (advisory; opt in)
```

## Install

### Option A: `--plugin-dir` (one shot)

From the repo root:

```bash
claude --plugin-dir plugins/bmad-tools
```

Inside the session, the `/bmad-tools:*` slash commands and the `validate-artifact` hook are active.

### Option B: `.claude/settings.json` (always on for this project)

Add the plugin to your project settings so every Claude Code session in this repo loads it:

```json
{
  "plugins": {
    "bmad-tools": {
      "path": "plugins/bmad-tools"
    }
  }
}
```

(Restart Claude Code for the change to be picked up.)

## Skills

| Slash command | What it does |
|---|---|
| `/bmad-tools:validate-artifact <path>` | Schema-check a single artifact file (story, PRD, architecture, epic, brainstorm). Reports blocking + advisory issues with suggested fixes. Read-only. |
| `/bmad-tools:project-status` | One-page dashboard: phase, story counts (planned / in-progress / review / done / blocked), pending human approvals (PRDs / plans / architecture / ADRs), recent decisions, suggested next action. |
| `/bmad-tools:score-complexity <request text>` | Score a request on the BMAD 5-dimension complexity table (5–15). Recommends entry workflow (`/bug`, `/feature`, full-lifecycle) and autonomy level. |
| `/bmad-tools:extract-lessons [<epic-id\|glob>] [--apply]` | Cluster review findings for an epic and propose an append to `artifacts/context/lessons-learned.md`. With no input, scans all reviews. With `--apply` (or in auto-mode projects), writes directly. |
| `/bmad-tools:audit-decisions` | Walk `decision-log.md` for declared D-IDs (numeric and subdomain like `D-BRN-1`), grep `artifacts/planning\|design\|implementation` for references, report orphans and dangling references. |
| `/bmad-tools:schema-doctor [--type story\|prd\|architecture\|decision\|all]` | Whole-tree audit: produce a drift heatmap of how far the on-disk artifacts diverge from `methodology/artifact-schemas/`. Read-only. |
| `/bmad-tools:migrate-stories [--apply] [--glob "<pattern>"]` | Rewrite old-format stories into the documented schema (rename `## Goal` → `## User Story`, insert `## Status:`, stub `## Tasks`). Default dry-run; `--apply` writes. |

### Usage examples

```text
/bmad-tools:validate-artifact artifacts/implementation/stories/story-1.2.md
/bmad-tools:project-status
/bmad-tools:score-complexity Add password reset via email with rate limiting
/bmad-tools:extract-lessons epic-1
/bmad-tools:extract-lessons                 # falls back to all reviews
/bmad-tools:extract-lessons epic-1 --apply
/bmad-tools:audit-decisions
/bmad-tools:schema-doctor
/bmad-tools:schema-doctor --type story
/bmad-tools:migrate-stories                 # dry-run on every story
/bmad-tools:migrate-stories --apply         # writes the migration in place
```

## Hooks

### `validate-artifact` (ON by default; advisory mode by default)

`PreToolUse` matcher `Edit|Write`. When a Write event targets a `.md` file under `artifacts/planning/` or `artifacts/implementation/`, the hook checks the post-edit content against the matching schema (story / PRD / architecture / epic / generic).

Mode is read from `${CLAUDE_PLUGIN_DIR}/.claude-plugin/plugin.json` under the top-level key `config.validatorMode`:

```json
{
  "config": {
    "validatorMode": "advisory"
  }
}
```

| Mode | Schema-fail behavior |
|---|---|
| `"advisory"` (default) | Print warning to stderr. Return `permissionDecision: "allow"`. Exit code **1**. The user sees the warning but the write proceeds. |
| `"strict"` | Return `permissionDecision: "deny"`. Exit code **2**. The write is blocked (v0.1.0 behavior). |

If the config key is missing or unreadable, the hook defaults to `advisory`.

Edit events are not validated (applying a diff to verify post-edit content is fragile — fail open). The hook also fails open on any unexpected error so a broken hook will never block the user.

`## Goal` is accepted as a legacy alias for `## User Story` during the story check.

### `audit-decisions` (OFF by default — opt in)

`PreToolUse` matcher `Bash`, triggered only on `git commit` commands. Runs the same audit as `/bmad-tools:audit-decisions` and prints orphan / dangling findings to stderr. **Never blocks the commit** — advisory only in this first version.

It is shipped disabled. To enable it, edit `plugins/bmad-tools/hooks/hooks.json`:

```diff
 {
   "PreToolUse": [
     { "matcher": "Edit|Write", "hooks": [...] }
+    ,
+    {
+      "matcher": "Bash",
+      "hooks": [
+        {
+          "type": "command",
+          "command": "node \"${CLAUDE_PLUGIN_DIR}/hooks/audit-decisions.cjs\""
+        }
+      ]
+    }
   ],
-  "_disabled_audit_decisions": { ... }
 }
```

(Or simply rename the `"_disabled_audit_decisions"` key to merge its config into the top level.) Then restart Claude Code.

The hook uses the v0.2.0 D-ID regex:

- **Declared**: `^##+\s+(D-[A-Z0-9]+(?:-\d+)?)\b` — matches `## D-001`, `### D-022:`, `## D-BRN-1`.
- **Referenced**: `\bD-(?:\d{3,}|[A-Z]{2,}-\d+)\b` — matches `D-005`, `D-BRN-2` in body text. Rejects placeholders `D-ID`, `D-N`, `D-NNN`.

## Build constraints

- **Node stdlib only** in hooks. No npm dependencies.
- Hooks read JSON from stdin via `fs.readFileSync(0, 'utf-8')` and exit 0/1/2 per the Claude Code hook contract (1 = advisory warning, 2 = strict deny, 0 = pass).
- Hooks are invoked through `node` explicitly so they work on Windows without a shebang.
- Skills are pure Markdown with YAML frontmatter (`name`, `description`, `allowed-tools`).

## Limitations

- The `validate-artifact` hook only validates `Write` events. `Edit` events pass through (computing post-edit content from a partial diff is fragile; the on-demand `/bmad-tools:validate-artifact` skill covers gaps).
- Schema fallbacks are hard-coded for resilience — if `methodology/artifact-schemas/` is absent, the validator uses minimal expected-section rules listed in the skill body.
- The `audit-decisions` hook is advisory in this version. Strict-block mode is deferred to a follow-up.
- `migrate-stories` only migrates stories. PRDs and architecture documents are out of scope for v0.2.0.
- Marketplace distribution (`marketplace.json`) is out of scope for v0.2.0.

## Verifying the plugin

From the repo root, all of the following should succeed:

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/bmad-tools/.claude-plugin/plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/bmad-tools/hooks/hooks.json','utf8'))"

# Story missing acceptance criteria — in default advisory mode, exits 1 with allow
echo '{"tool_input":{"file_path":"artifacts/implementation/stories/story-test.md","content":"# test\n\nno acceptance criteria"}}' | node plugins/bmad-tools/hooks/validate-artifact.cjs

# Non-artifact file — should exit 0 (out of scope)
echo '{"tool_input":{"file_path":"src/index.ts","content":""}}' | node plugins/bmad-tools/hooks/validate-artifact.cjs
```
