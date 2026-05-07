# BMAD Console v0.3

A real-time editorial-meets-mission-control dashboard for an autonomous BMAD-Swarm
project. It renders `artifacts/` as a living document — phase ribbon, decision
cartouches, agent roster, activity stream, sprint lanes, decision-network graph,
draggable replay scrubber, and a per-phase **writer** that drives the project
forward — instead of yet another chat log.

This plugin is local-first, ships zero npm dependencies, and is designed for the
auto-mode user who walked away for an hour and wants to know within three seconds
what phase they're in, what's pending approval, and what changed — and now wants
to *do work* without dropping back to the terminal.

## What's new in v0.3

- **Writer mode** — a fifth top-level tab. The console can now create and edit
  the artifacts that drive each BMAD phase, not just visualize them.
  - **Ideation writer** (full): a paper writing surface with a 640px column,
    Source Serif 4 prose, and a sidebar of structured prompts ("Who's it for?",
    "What problem does it solve?", "Why now?", "What does v1 look like?"). The
    composed brief autosaves to `artifacts/planning/product-brief.md` 500ms
    after the last keystroke. A "Mark ready for exploration" CTA flips
    `project.yaml.phase` after a confirmation modal.
  - **Definition writer** (full): a three-column PRD builder — Problem, Users,
    Functional Requirements, Non-Functional Requirements, Success Criteria.
    FRs are drag-reorderable cards (HTML5 drag-drop, no library) that
    auto-renumber on drop. Each FR has an inline AC sub-list. Autosaves the
    composed PRD to `artifacts/planning/prd.md`. "Mark PRD ready" surfaces it
    to the approval panel after a required-section validation.
  - **Approval panel**: pending PRD / architecture approvals render as
    paper "PENDING" cards in a right rail. "Approve" appends an
    `Approved-by: <user>` block; "Send back" surfaces an inline note input
    that writes a `Status: needs-revision` block.
  - **Stub writers**: Exploration / Design / Implementation / Delivery each
    show a paper "v0.4 coming" card describing what the writer will look
    like. The CLI is the workflow for those phases for now.
- **New server endpoints**:
  - `PUT /api/artifact` — body `{ path, content }` → writes the file. Path
    must match the allowlist (planning/product-brief.md, planning/prd.md,
    exploration/*.md, design/architecture.md, design/decisions/adr-*.md,
    implementation/stories/story-*.md). Anything else → 403. `..`, absolute
    paths, and Windows-style backslashes are rejected. Demo mode is
    read-only and returns 403.
  - `POST /api/gate` — body `{ phase, action, note? }`.
    - `action: "pass"` updates `project.yaml.phase` (preserving other
      top-level keys via a line-based rewrite) and sets
      `status: in-progress`.
    - `action: "approve"` appends `Approved-by: <user>` +
      `Approved-on: <ISO>` to the relevant artifact (`prd.md` for
      `phase=definition`, `architecture.md` for `phase=design`).
    - `action: "needs-revision"` appends a `Status: needs-revision` block
      with the note. `<user>` comes from `process.env.USER || USERNAME`.
- **SSE `write` event**: every successful artifact write fan-outs a
  `data: { type, path, action }` event so other open browser tabs (and the
  Dashboard view in the same tab) refresh state automatically.
- **`--enable-agents` flag** (off by default, scaffolding only in v0.3):
  reserves the wire for subprocess `claude -p` invocation. The actual
  agent-invoker subprocess shell ships in v0.4 — this v0.3 build records
  the flag and surfaces it in the boot banner without spawning anything.

## What's new in v0.2

- **Sprint view** — Track A/B/C lanes with story cards and dependency hairlines.
  Predecessor status colors the arrow: blocked → vermillion, incomplete → amber,
  complete → rule grey.
- **Decision Network view** — D-IDs as 28×28 squares in a force-directed graph
  drawn into a single SVG. Click a node to expand its cartouche; hover to highlight
  edges. Layout is deterministic (seed = node index, 100 iterations, then frozen),
  pure-JS, no library.
- **Replay scrubber** — pinned to the bottom of the Dashboard, above the keybar.
  Each event is a 2px tick coloured by type. Drag the playhead to any point in
  the past and the dashboard panels recompute as if it were that moment. The
  Live button snaps back to present; the play button sweeps from the current
  playhead to live over five seconds.
- **Demo mode** (`--demo`) — boot the console with a 12-decision / 14-story
  synthetic project so anyone forking the repo can see every view fully populated.

## Screenshots (ASCII)

### Home — Live Dashboard

```
+---------------------------------------------------------------------------+
| BMAD-SWARM   PORTFOLIO 2026   ISSUE No 26   2026-05-07   AUTONOMY: AUTO   |
+--+------------------------------------------------------------------------+
|  |  CURRENT FOCUS         RECENT DECISIONS         ROSTER                 |
|i |  Phase: Definition     D-022  STRATEGIC         @ orchestrator  idle   |
|d |  Producing: PRD        Adopt CSS Anchor Pos     @ strategist     WORK  |
|e |  Gate: prd-quality     2026-04-29  architect    @ architect     idle   |
|a |                                                  @ developer (a) WORK  |
|t |  PENDING               D-021  TACTICAL          @ reviewer      idle   |
|i |  > PRD awaits          Use SARIMAX over ...     @ qa             -     |
|o |    approval                                                            |
|n |                        ACTIVITY                  Stories               |
|  |                        16:42 decision   D-022    Total          18     |
|e |                        16:40 review     story-7  Complete       12     |
|x |                        16:31 commit     b3a9f0c  In Progress     3     |
|  |                                                                        |
+--+------------------------------------------------------------------------+
| d decisions   s stories (v0.2)   r refresh   t paper/inverse   ? help     |
+---------------------------------------------------------------------------+
```

### Decision view

```
DECISIONS  26 DECLARED  24 REFERENCED  0 ORPHAN  2 DANGLING

[ all classifications v ]  [ all phases v ]  [ search... ]

+---------------------------+ +---------------------------+ +---------------------------+
| D-022    STRATEGIC        | | D-021    TACTICAL         | | D-020    STRATEGIC        |
|---------------------------| |---------------------------| |---------------------------|
| Adopt CSS Anchor          | | Use SARIMAX over Prophet  | | Drop GraphQL layer        |
| Positioning for popover   | | for monthly forecasts     | | for v1; REST is enough    |
|                           | |                           | |                           |
| 2026-04-29 . architect    | | 2026-04-28 . developer    | | 2026-04-25 . architect    |
| Affects: architecture.md, | | Affects: story-7.4        | | Affects: architecture.md, |
|          story-7.2        | |                           | |          PRD FR-12        |
+---------------------------+ +---------------------------+ +---------------------------+
```

### "Since you left" digest (cold open)

```
+---------------------------------------------------------+
|                                                         |
|              SINCE YOU LEFT - 1h 12m                    |
|         -----------------------------------             |
|                                                         |
|     3   decisions logged       D-021 D-022 D-023        |
|     2   stories complete       7.1  7.2                 |
|     1   review filed           review-7.2 (REJECTED)    |
|     1   phase transition       DESIGN -> IMPLEMENTATION |
|                                                         |
|         -----------------------------------             |
|                                                         |
|     PENDING YOUR ATTENTION                              |
|         > Architecture awaits approval                  |
|         > Story 7.2 review REJECTED                     |
|                                                         |
|              [   ENTER CONSOLE   ]                      |
+---------------------------------------------------------+
```

## Install

The plugin is local-first; you can use it directly from the repo:

```
claude --plugin-dir plugins/bmad-console
```

It does not need to be on the marketplace; in v0.1 it ships only as a sibling
plugin in this repo.

## Run

From inside any BMAD-Swarm project (the server walks up looking for
`swarm.yaml` or `project.yaml`):

```
node plugins/bmad-console/bin/start.cjs
```

On Windows you can also run the cmd wrapper:

```
plugins\bmad-console\bin\bmad-console.cmd
```

Then open http://127.0.0.1:5173 in a browser.

Flags:

- `--port <n>` — bind a different TCP port (default 5173).
- `--host <h>` — bind a different host (default 127.0.0.1; intentionally not 0.0.0.0).
- `--root <path>` — pass an explicit project root if auto-discovery fails.
- `--demo` — boot with a synthetic project instead of the local `artifacts/`.
  Useful for screenshots, code review, or trying the console before adopting BMAD.
  In demo mode, the file watcher is disabled, the writer endpoints reject all
  writes with 403, and the masthead is stamped `[DEMO]`.
- `--enable-agents` — reserve the wire for subprocess agent invocation
  (v0.4). Off by default. v0.3 only records the flag in the boot banner; no
  subprocess is spawned until the v0.4 agent-invoker ships. **Security note**:
  even when enabled in v0.4, the server will still bind 127.0.0.1 only and
  require localhost calls; do not expose this server to a network you don't
  trust.

## Views

- **Dashboard** (default) — phase ribbon, current focus + pending approvals,
  recent decisions, activity stream, agent roster, story-status mini-summary,
  and the replay scrubber along the bottom edge.
- **Decisions** — every D-ID rendered as a cartouche; filter by classification,
  phase, or text.
- **Sprint** — Track A/B/C lanes with story cards and dependency arrows. Card
  border + arrow color reflect predecessor status (vermillion = blocked, amber
  = predecessor not yet complete, rule grey = clean). Empty state points the
  reader at `/bmad-tools:scaffold-ui-story`.
- **Network** — D-IDs as 28×28 paper squares in a force-directed graph (single
  SVG, deterministic seed, 100 iterations, frozen on render). Strategic = phosphor
  wash, Tactical = paper, Operational = ink-muted wash. Hover to highlight
  neighbours; click a node to expand its cartouche underneath. Edges are
  bidirectional reference relationships.
- **Writer** *(v0.3)* — per-phase writing surfaces. Two are full (Ideation,
  Definition); the other four (Exploration, Design, Implementation, Delivery)
  show "v0.4 coming" stubs and tell you to use the CLI for now. A right-rail
  approval panel surfaces any artifact that lacks an `Approved-by:` line.

## Writer mode (v0.3)

Click `WRITER` (or press `w`) to enter writer mode. The view has three columns:

1. **Phase strip** (left): six phases mirroring the dashboard ribbon. The
   project's current phase is marked with a `◉`. Click any phase to load its
   writer.
2. **Canvas** (center): the active writer.
   - **Ideation** is a single-column paper surface plus a sidebar of structured
     prompts. Whatever you type composes a coherent
     `artifacts/planning/product-brief.md` and autosaves 500ms after you stop
     typing. The "Mark ready for exploration" button asks for confirmation, then
     transitions `project.yaml.phase` via `POST /api/gate`.
   - **Definition** is a structured PRD builder. Functional Requirements are
     drag-reorderable cards that auto-renumber (FR-1, FR-2, …) on drop; each
     has a sub-list of Given/When/Then acceptance criteria. NFRs use a
     simpler card with a `Target:` field. Autosaves to
     `artifacts/planning/prd.md`. "Mark PRD ready" validates the required
     sections (Problem / Users / FR / Success) and then surfaces the PRD to
     the approval panel.
   - The other four phases show a centered "v0.4 coming" card; use the CLI for
     those phases for now.
3. **Approval rail** (right): pending PRD / architecture approvals render as
   "PENDING" stamp cards. Approve → appends `Approved-by: <user>`. Send back →
   inline note form, then writes a `Status: needs-revision` block. The user is
   read from `process.env.USER` or `USERNAME` on the server.

### Autosave behaviour

- Every textarea is debounced 500ms after the last keystroke. After a brief
  "saving…" pip the status flips to "saved".
- The whole writer composes one coherent markdown file per save — the writer
  UI is the source of truth. **If you hand-edit `prd.md` in your text editor
  while the writer is open, your edits will be clobbered on the next
  autosave.** Treat git as the history layer.
- Multiple browser tabs editing the same artifact are last-write-wins. Other
  tabs receive an SSE `write` event and re-fetch state, so the dashboard
  always reflects the latest committed copy.

### What this isn't

- **Not collaborative.** Single-user only. There is no presence, no operational
  transform, no conflict resolution.
- **No authentication.** The server binds 127.0.0.1 only and is intended for
  use on the same machine as the project. Do not expose it.
- **No spell/syntax check** in the writer. Use `bmad-tools:validate-artifact`.
- **No drafts / version history.** Use git.

## Replay scrubber

A 36px stripe pinned above the keybar on the Dashboard view. Each timed event
in the project (decisions, story updates, reviews, file changes) is a 2px tick
on the stripe coloured by type:

- decision → phosphor
- story → ink-muted
- review → amber
- file → faint rule

The phosphor playhead is draggable. When it's not at the present, the
dashboard reconstructs its panels from the subset of state with timestamp ≤ the
playhead position, and a `VIEWING HISTORY` banner appears above the canvas. The
LIVE button snaps back to present; the ▶ button sweeps the playhead from the
current position to live over five seconds.

## Keyboard shortcuts

- `d` — decisions view
- `s` — sprint view
- `n` — network view
- `w` — writer view
- `h` — dashboard
- `r` — refresh state from server
- `l` — return to live (scrubber)
- `t` — toggle paper / inverse mode
- `?` — help
- `Esc` — dismiss the "since you left" digest

## How it parses

The server walks the project root and reads:

- `swarm.yaml` and `project.yaml` for project + phase + autonomy
- `methodology/phases.yaml` for the phase definitions and gate metadata
- `artifacts/context/decision-log.md` for D-IDs (declared with `## D-NNN —`)
- `artifacts/implementation/stories/*.md` for story status, track, ACs
- `artifacts/reviews/*.md` for review status (BLOCKING / ADVISORY counts)
- everything under `artifacts/**` for the activity stream (mtime-sorted)

The parsers are drift-tolerant. If a story file has no `## Status:` line, we
report `unknown` instead of crashing. If the decision-log uses `**Source:**`
instead of `**Author:**`, we use that. Block scalars in YAML are handled by a
minimal indent-based parser (no `js-yaml` — stdlib only).

## Distinguishing features

1. **Phase Ribbon** — a vertical stack of named "stations" down the left edge
   showing the project's six phases. No other AI tool has phases.
2. **Decision Cartouche** — each D-ID renders as a paper card with a tilted
   stencil ID stamp, classification badge, serif title, mono dateline, body,
   and hairline "Affects:" footer.
3. **Roster Panel** — a vertical list of agents with 7px square status dots
   (work/idle/-). Squares not circles, because circles read as social avatars.
4. **Sprint Lane** *(v0.2)* — Track A/B/C/cross-cutting lanes with 180×64
   story cards, dependency arrows whose colour reflects predecessor status,
   and an in-progress glyph that pulses on the phosphor budget.
5. **Editorial Masthead** — project name in display serif, dateline in mono,
   issue number = decision count.
6. **Quality-Gate Stamp** — pending PRD/architecture approval renders as an
   amber rotated stencil tag overlaid on the pending list.
7. **"Since I Last Looked" Digest** — boots into a cold-open digest panel when
   `localStorage.bmad_last_visit` is older than 5 minutes. Counts decisions,
   stories, reviews since the last visit + lists pending approvals.
8. **Decision Network** *(v0.2)* — force-directed map of D-ID cross-references.
   Clusters of connected decisions read as cohesive subsystems; orphan nodes
   stand out as decisions worth reconciling.
9. **Replay Scrubber** *(v0.2)* — drag the playhead and the dashboard rewinds.
   The flagship auto-mode time-travel feature.

## Known limitations / TODO(v0.3)

- Phase-status detection is best-effort: a phase whose required artifacts all
  exist but where `project.yaml.phase` doesn't agree is classified by
  `project.yaml`.
- The fs.watch on Linux is non-recursive (we walk one level). Deep nested
  directories may take an extra polling cycle.
- The roster's "last activity" heuristic is a directory-name match, not a real
  workflow signal. This is good enough for the auto-mode glance.
- Replay scrubber state reconstruction relies on whatever timestamps live in
  the artifacts. Stories without per-status timestamps are projected via their
  earliest activity event; this is a best-effort proxy, not a true history log.

## v0.3 roadmap

- Stories view with full per-story drill-down (acceptance criteria, ACs ticked,
  review history).
- Phase ribbon click-to-filter on the canvas.
- Quality-gate stamp graphics for the phase ribbon, not just the pending list.
- Per-cartouche expand-in-place with the full decision body and ADR link.
- Network view filters by classification + phase.
