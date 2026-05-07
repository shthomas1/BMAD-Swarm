# bmad-tools

A Claude Code plugin pack for BMAD-Swarm projects. Bundles five skills under the `/bmad-tools:*` namespace plus two hooks that close the highest-friction gaps in the BMAD workflow:

- artifact validation
- project status dashboard
- complexity scoring
- post-epic lessons extraction
- decision-log auditing

Local-first. Marketplace distribution is future work.

## Layout

```
plugins/bmad-tools/
├── .claude-plugin/plugin.json
├── README.md
├── skills/
│   ├── validate-artifact/SKILL.md
│   ├── project-status/SKILL.md
│   ├── score-complexity/SKILL.md
│   ├── extract-lessons/SKILL.md
│   └── audit-decisions/SKILL.md
└── hooks/
    ├── hooks.json
    ├── validate-artifact.cjs   # ON by default (PreToolUse on Write)
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
| `/bmad-tools:project-status` | One-page dashboard: phase, story counts (planned / in-progress / review / done / blocked), pending human approvals, recent decisions, suggested next action. |
| `/bmad-tools:score-complexity <request text>` | Score a request on the BMAD 5-dimension complexity table (5–15). Recommends entry workflow (`/bug`, `/feature`, full-lifecycle) and autonomy level. |
| `/bmad-tools:extract-lessons <epic-id\|glob> [--apply]` | Cluster review findings for an epic and propose an append to `artifacts/context/lessons-learned.md`. With `--apply` (or in auto-mode projects), writes directly. |
| `/bmad-tools:audit-decisions` | Walk `decision-log.md` for declared D-IDs, grep `artifacts/planning|design|implementation` for references, report orphans and dangling references. |

### Usage examples

```text
/bmad-tools:validate-artifact artifacts/implementation/stories/story-1.2.md
/bmad-tools:project-status
/bmad-tools:score-complexity Add password reset via email with rate limiting
/bmad-tools:extract-lessons epic-1
/bmad-tools:extract-lessons epic-1 --apply
/bmad-tools:audit-decisions
```

## Hooks

### `validate-artifact` (ON by default)

`PreToolUse` matcher `Edit|Write`. When a Write event targets a `.md` file under `artifacts/planning/` or `artifacts/implementation/`, the hook checks the post-edit content against the matching schema (story / PRD / architecture / epic / generic). On schema fail it returns a `permissionDecision: "deny"` payload and exits 2 with a clear reason; otherwise it exits 0. Edit events are not validated (applying a diff to verify post-edit content is fragile — fail open).

The hook fails open on any unexpected error so a broken hook will never block the user.

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

## Build constraints

- **Node stdlib only** in hooks. No npm dependencies.
- Hooks read JSON from stdin via `fs.readFileSync(0, 'utf-8')` and exit 0/2 per the Claude Code hook contract.
- Hooks are invoked through `node` explicitly so they work on Windows without a shebang.
- Skills are pure Markdown with YAML frontmatter (`name`, `description`, `allowed-tools`).

## Limitations

- The `validate-artifact` hook only validates `Write` events. `Edit` events pass through (computing post-edit content from a partial diff is fragile; the on-demand `/bmad-tools:validate-artifact` skill covers gaps).
- Schema fallbacks are hard-coded for resilience — if `methodology/artifact-schemas/` is absent, the validator uses minimal expected-section rules listed in the skill body. Re-running on a project with the schemas present will use them automatically.
- The `audit-decisions` hook is advisory in this version. Strict-block mode is deferred to a follow-up.
- Marketplace distribution (`marketplace.json`) is out of scope for v0.1.0.

## Verifying the plugin

From the repo root, all of the following should succeed:

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/bmad-tools/.claude-plugin/plugin.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('plugins/bmad-tools/hooks/hooks.json','utf8'))"

# Story missing acceptance criteria — should exit 2
node plugins/bmad-tools/hooks/validate-artifact.cjs <<< '{"tool_input":{"file_path":"artifacts/implementation/stories/story-test.md","content":"# test\n\nno acceptance criteria"}}'

# Non-artifact file — should exit 0 (fail open / out of scope)
node plugins/bmad-tools/hooks/validate-artifact.cjs <<< '{"tool_input":{"file_path":"src/index.ts","content":""}}'
```
