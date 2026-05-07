# bmad-ui

A Claude Code plugin pack that specializes BMAD-Swarm for UI/UX projects. Bundles four skills under the `/bmad-ui:*` namespace plus a `ux-reviewer` identity agent invocable as `@bmad-ui:ux-reviewer`. Native to BMAD's artifact + phase + identity model — every component slots into an existing phase or surfaces a new review type.

Local-first. Marketplace distribution is future work.

**Current version**: `0.1.0`

## Layout

```
plugins/bmad-ui/
|-- .claude-plugin/plugin.json    # name: bmad-ui, version: 0.1.0
|-- README.md
|-- agents/
|   `-- ux-reviewer.md            # subagent definition
`-- skills/
    |-- design-tokens/SKILL.md
    |-- scaffold-ui-story/SKILL.md
    |-- component-spec/SKILL.md
    `-- a11y-review/SKILL.md
```

No hooks in v0.1.0 — first version is skill + agent only. See [What's deferred to v0.2](#whats-deferred-to-v02).

## Install

### Option A: `--plugin-dir` (one shot)

From the repo root:

```bash
claude --plugin-dir plugins/bmad-ui
```

Or run alongside `bmad-tools`:

```bash
claude --plugin-dir plugins/bmad-tools --plugin-dir plugins/bmad-ui
```

Inside the session, the `/bmad-ui:*` slash commands and the `@bmad-ui:ux-reviewer` agent are active.

### Option B: `.claude/settings.json` (always on for this project)

Add the plugin to your project settings so every Claude Code session in this repo loads it:

```json
{
  "plugins": {
    "bmad-ui": {
      "path": "plugins/bmad-ui"
    }
  }
}
```

(Restart Claude Code for the change to be picked up.)

## Skills

| Slash command | What it does |
|---|---|
| `/bmad-ui:design-tokens <source>` | Extract design tokens (colors, typography, spacing, radii, shadows, breakpoints) from a CSS/SCSS/Tailwind/JSON config into `artifacts/design/design-tokens.md`. Each group gets a `D-?` stub for later promotion to a real D-ID. In auto-mode projects, prior versions are backed up to `design-tokens.md.bak`. |
| `/bmad-ui:scaffold-ui-story <story-id> "<title>"` | Scaffold a UI-flavored BMAD story at `artifacts/implementation/stories/story-<id>.md` extending the standard schema with Visual States (6), Accessibility AC (5 default), Browser Support, and Responsive Breakpoints. Refuses to overwrite. Auto-links to `design-tokens.md` and `components/<slug>.md` when present. |
| `/bmad-ui:component-spec "<component name>"` | Capture a UI component as a structured design artifact at `artifacts/design/components/<slug>.md` (Purpose, Props, Variants, Visual States, Slots, Behavior, Accessibility, Related Tokens, Related D-IDs). The design counterpart to a story. |
| `/bmad-ui:a11y-review <path-or-url>` | Heuristic accessibility audit of an HTML/JSX/TSX file or live URL. Spots common WCAG 2.1 AA violations and writes a categorized report (Critical / Major / Minor) to `artifacts/reviews/a11y-review-<basename>.md`. Pure-Markdown skill — Claude reads the source and applies a 15-item checklist. No headless browser, no axe-core. |

### Usage examples

```text
/bmad-ui:design-tokens src/styles/tokens.css
/bmad-ui:design-tokens tailwind.config.ts

/bmad-ui:scaffold-ui-story 1.4 "Order summary card on checkout"
/bmad-ui:scaffold-ui-story 2.10 "Empty state for inbox"

/bmad-ui:component-spec "Button"
/bmad-ui:component-spec "OrderSummaryCard"

/bmad-ui:a11y-review src/pages/Checkout.tsx
/bmad-ui:a11y-review https://staging.example.com/checkout
```

## Agent

### `@bmad-ui:ux-reviewer`

Adversarial UX, copy, and brand reviewer. Runs parallel to BMAD's existing security/code reviewer. Read-only — produces a single review report at `artifacts/reviews/ux-review-<scope>.md`.

Review checklist:

- Brand consistency (every color/spacing/radius value resolves to a token in `design-tokens.md`)
- Copy clarity, tone, microcopy
- Visual hierarchy (primary action is the most prominent thing on screen)
- Motion appropriateness (duration, easing, `prefers-reduced-motion`)
- Error states and empty states (no blank panels on async surfaces)
- Color contrast (4.5:1 body, 3:1 large/UI; checked in every state)
- Information density within the documented bracket
- Dark/light parity

#### Invocation

Direct invocation (Claude Code subagent namespace):

```text
@bmad-ui:ux-reviewer review story 1.4 against artifacts/design/design-tokens.md
@bmad-ui:ux-reviewer review components/order-summary-card.md vs src/components/OrderSummaryCard.tsx
```

Or via orchestrator delegation in a `bmad-assembly` block, alongside the existing reviewer identities.

## What's deferred to v0.2

The following are explicitly out of scope for `0.1.0` and tracked for a later release:

- **Hooks** — `PostToolUse(Write)` on a JSX/TSX file to auto-run `/bmad-ui:a11y-review`. Plus an opt-in `Stop` hook that triggers `@bmad-ui:ux-reviewer` after a UI story moves to `review` status.
- **axe-core integration** — would tighten the a11y skill from heuristic to authoritative, but adds an npm dependency. Deferred until BMAD-Swarm has a sanctioned dep policy for plugins.
- **Figma API integration** — read tokens and frames directly from Figma instead of from a local export. Requires API token handling and a network call; deferred.
- **Screenshot diffing** — visual-regression check against a baseline image. Belongs in a sibling `bmad-visual-diff` plugin, not here.

## Build constraints

- **Node stdlib only** in any future hook. No npm dependencies introduced by this plugin.
- Skills are pure Markdown with valid YAML frontmatter (`name`, `description`, `allowed-tools`).
- The `ux-reviewer` agent uses the Claude Code subagent frontmatter shape (`name`, `description`, `tools`, `model`).

## Verifying the plugin

From the repo root, the following should succeed:

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/bmad-ui/.claude-plugin/plugin.json','utf8'))"
```

(There is no `hooks.json` to validate in v0.1.0.)

You can also confirm the directory tree:

```bash
# Bash / WSL
find plugins/bmad-ui -type f | sort

# PowerShell
Get-ChildItem -Recurse -File plugins/bmad-ui | Sort-Object FullName | Select-Object -ExpandProperty FullName
```

Expected files:

- `plugins/bmad-ui/.claude-plugin/plugin.json`
- `plugins/bmad-ui/README.md`
- `plugins/bmad-ui/agents/ux-reviewer.md`
- `plugins/bmad-ui/skills/a11y-review/SKILL.md`
- `plugins/bmad-ui/skills/component-spec/SKILL.md`
- `plugins/bmad-ui/skills/design-tokens/SKILL.md`
- `plugins/bmad-ui/skills/scaffold-ui-story/SKILL.md`

## Limitations

- `a11y-review` is heuristic — false positives are possible when context (an off-screen label, an externally-defined `aria-labelledby` target) is hidden from a static read. Re-run after fixes; consider axe-core in v0.2.
- `design-tokens` does not currently extract from a live URL or a Figma file; it expects a local CSS / SCSS / Tailwind / JSON source.
- `component-spec` synthesizes from whatever the user provides (Figma URL, screenshot description, or text brief). When a designer is available, prefer their direct input over inference.
- `ux-reviewer` is read-only and does not update story files on approval — that responsibility stays with the existing code reviewer per BMAD's review phase contract.
