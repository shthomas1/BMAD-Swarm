# bmad-statusline

A Claude Code `statusLine` plugin that surfaces **BMAD-Swarm project state**
in the terminal status bar — phase, autonomy, agent count, pending
human-approval flags, and the latest decision ID.

## What it shows

Single line, ANSI-coloured by default:

```
◉ bmad-swarm · DELIVERY · auto · @4 active · D-022
```

When pending human approvals exist, an amber flag (⚑) appears between
the autonomy and agent-count segments:

```
◉ portfolio · DEFINITION · auto · ⚑1 · @3 active · D-019
```

When run outside any BMAD project (no `swarm.yaml` or `project.yaml` in
the cwd or any of the 12 nearest ancestors):

```
◉ no BMAD project
```

### Segments

| Segment | Source |
| --- | --- |
| `◉ <project>` | `project.yaml` `project.name` (or `swarm.yaml` `project.name`) |
| `<PHASE>` | `project.yaml` `phase`, uppercased |
| `<autonomy>` | `swarm.yaml` `methodology.autonomy` |
| `⚑N` | Count of `prd*.md` / `architecture*.md` artifacts missing an `Approved` marker |
| `@N active` | `swarm.yaml` `team:` block size; falls back to a per-phase default |
| `D-NNN` | First D-ID heading in `artifacts/context/decision-log.md` |

The `⚑N` segment is omitted when zero approvals are pending. The `D-NNN`
segment is omitted when no decision log exists.

## Install

Add this entry to `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"${CLAUDE_PLUGIN_DIR}/bin/statusline.cjs\"",
    "padding": 0
  }
}
```

Claude Code feeds the script a small JSON payload on stdin
(`{ cwd, model, transcriptPath, ... }`) and renders whatever the script
prints on stdout.

## How it differs from generic statuslines

Most AI-tool statuslines (e.g. `ccstatusline`) surface generic terminal
context: model name, working directory, token usage, time. They give you
**no signal that you're in the middle of a BMAD workflow**.

`bmad-statusline` surfaces the BMAD-specific state you care about:

* **Phase** — exploration / definition / design / implementation / delivery.
* **Autonomy** — auto / supervised / strict.
* **Pending human approvals** — the amber flag is impossible to miss
  when a PRD or architecture doc is waiting on a sign-off.
* **Active agent count** — quick read on team size from `swarm.yaml`.
* **Latest decision ID** — the most-recent `D-NNN` in the decision log;
  useful as a "you are here" pointer into project history.

It deliberately *omits* model name and cwd: those are visible elsewhere
in Claude Code, and BMAD state is the differentiator.

## NO_COLOR support

Set `NO_COLOR=1` (or any non-empty value) to disable ANSI colour codes.
The plugin honours [NO_COLOR](https://no-color.org). Default colours:

* Phosphor green — project name and the `◉` marker.
* Amber — `⚑N` flag.
* Dim — `·` separators.
* Default terminal colour — everything else.

## Performance budget

Designed to run on **every prompt**:

* At most ~5 small files read (`project.yaml`, `swarm.yaml`,
  decision-log head, prd head, architecture head).
* `decision-log.md` is read first 64KB only — the latest D-IDs live near
  the top of the file in BMAD's append-newest-first convention.
* No state is cached between invocations (statelessness > clever
  invalidation in v0.1).
* Cold-run target: < 100ms on a warm OS file cache (excludes Node
  startup; the test suite measures end-to-end with a 1500ms budget that
  includes `node --test` overhead).

## Limitations

* No caching: rereads the YAML on every prompt. Negligible at the file
  sizes BMAD uses, but not free.
* Project root walk-up depth capped at 12 levels (covers any sane
  monorepo layout; pathological deep nesting is not supported).
* Approval detection is heuristic: looks for `Status: approved`,
  `Approved by:`, or a `## Approval` heading. Other conventions read as
  pending.
* Agent count: when `swarm.yaml` lacks a `team:` block, falls back to a
  hard-coded per-phase default rather than introspecting
  `methodology/phases.yaml`. Good enough for the headline; consult
  `/bmad-tools:status` for the exact roster.
* Pure stdlib YAML parser: covers the BMAD config dialect (top-level
  keys, nested objects, lists, scalars). Inline flow-style
  (`{a: 1}`, `[a, b]`) is not supported.
* Crash-safe by design: any unexpected error degrades to a minimal
  `◉ <project>` (or `◉ no BMAD project`) output. The script never
  throws and never exits non-zero.

## Test

```sh
node --test plugins/bmad-statusline/tests/statusline.test.cjs
```

## Manual smoke

```sh
echo '{"cwd":"C:/Users/.../BMAD-Swarm"}' | node plugins/bmad-statusline/bin/statusline.cjs
```
