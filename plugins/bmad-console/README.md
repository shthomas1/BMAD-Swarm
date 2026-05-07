# BMAD Console v0.2

A real-time editorial-meets-mission-control dashboard for an autonomous BMAD-Swarm
project. It renders `artifacts/` as a living document — phase ribbon, decision
cartouches, agent roster, activity stream, sprint lanes, decision-network graph,
and a draggable replay scrubber — instead of yet another chat log.

This plugin is local-first, ships zero npm dependencies, and is designed for the
auto-mode user who walked away for an hour and wants to know within three seconds
what phase they're in, what's pending approval, and what changed.

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
  In demo mode, the file watcher is disabled and the masthead is stamped `[DEMO]`.

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
