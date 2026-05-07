# BMAD Console v0.1

A real-time editorial-meets-mission-control dashboard for an autonomous BMAD-Swarm
project. It renders `artifacts/` as a living document — phase ribbon, decision
cartouches, agent roster, activity stream — instead of yet another chat log.

This plugin is local-first, ships zero npm dependencies, and is designed for the
auto-mode user who walked away for an hour and wants to know within three seconds
what phase they're in, what's pending approval, and what changed.

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

## Views

- **Dashboard** (default) — phase ribbon, current focus + pending approvals,
  recent decisions, activity stream, agent roster, story-status mini-summary.
- **Decisions** — every D-ID rendered as a cartouche; filter by classification,
  phase, or text.
- *(v0.2)* **Implementation / Sprint** — Track A/B/C lanes with story cards
  and dependency hairlines.
- *(v0.2)* **Decision Network** — force-directed graph of decision references.

## Keyboard shortcuts

- `d` — decisions view
- `s` — stories view (v0.2)
- `r` — refresh state from server
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

The seven elements that make this Console look like nothing else:

1. **Phase Ribbon** — a vertical stack of named "stations" down the left edge
   showing the project's six phases. No other AI tool has phases.
2. **Decision Cartouche** — each D-ID renders as a paper card with a tilted
   stencil ID stamp, classification badge, serif title, mono dateline, body,
   and hairline "Affects:" footer.
3. **Roster Panel** — a vertical list of agents with 7px square status dots
   (work/idle/-). Squares not circles, because circles read as social avatars.
4. **Sprint Lane** — *(deferred to v0.2)* — Track A/B/C as horizontal lanes.
5. **Editorial Masthead** — project name in display serif, dateline in mono,
   issue number = decision count.
6. **Quality-Gate Stamp** — pending PRD/architecture approval renders as an
   amber rotated stencil tag overlaid on the pending list.
7. **"Since I Last Looked" Digest** — boots into a cold-open digest panel when
   `localStorage.bmad_last_visit` is older than 5 minutes. Counts decisions,
   stories, reviews since the last visit + lists pending approvals. The flagship
   auto-mode feature.

## Known limitations / TODO(v0.2)

- The Implementation / Sprint view is a placeholder; the dashboard's
  story-status mini-summary covers the basics in v0.1.
- The Decision Network view is not implemented yet — see "v0.2 roadmap".
- Phase-status detection is best-effort: a phase whose required artifacts all
  exist but where `project.yaml.phase` doesn't agree is classified by
  `project.yaml`.
- The fs.watch on Linux is non-recursive (we walk one level). Deep nested
  directories may take an extra polling cycle.
- The roster's "last activity" heuristic is a directory-name match, not a real
  workflow signal. This is good enough for the auto-mode glance.

## v0.2 roadmap

- Implementation / Sprint view (Track A/B/C lanes with dependency hairlines).
- Decision Network (force-directed) view.
- Stories view with full per-story drill-down.
- Phase ribbon click-to-filter on the canvas.
- Quality-gate stamp graphics for the phase ribbon, not just the pending list.
- Per-cartouche expand-in-place with the full decision body and ADR link.
