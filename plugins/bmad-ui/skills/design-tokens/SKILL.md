---
name: design-tokens
description: Extract design tokens (colors, typography, spacing, radii, shadows, breakpoints) from a CSS, SCSS, Tailwind config, or JSON token file into a structured artifact at artifacts/design/design-tokens.md. Use when the user invokes /bmad-ui:design-tokens or asks to capture design tokens as a BMAD decision artifact.
allowed-tools: Read Grep Glob Bash Write
---

# Design Tokens

Read a design-token source file (CSS/SCSS/Tailwind/JSON) and synthesize a structured token reference at `artifacts/design/design-tokens.md`. Each group is a referenceable BMAD decision (D-ID stub).

## Inputs

`$ARGUMENTS` — path to a CSS, SCSS, Tailwind config, or JSON token file (relative to repo root or absolute). Optional.

If `$ARGUMENTS` is empty, ask the user for the source path, then stop.

## Dynamic context

- Source file: !`type "$ARGUMENTS" 2>nul || cat "$ARGUMENTS" 2>/dev/null`
- Existing tokens artifact: !`type artifacts\design\design-tokens.md 2>nul || cat artifacts/design/design-tokens.md 2>/dev/null`

## What you do (Claude)

1. Resolve `$ARGUMENTS`. If the path does not exist or is unreadable, report and stop.
2. Read the file with the Read tool. Identify the format from the extension and content (CSS custom properties, SCSS `$variable` declarations, Tailwind `theme.extend` blocks in `tailwind.config.{js,ts,cjs,mjs}`, or a JSON design-token document).
3. Extract token groups:
   - **Colors** — name, hex/rgb/hsl value, role (`primary`, `secondary`, `neutral`, `semantic-success`, `semantic-warning`, `semantic-error`, `surface`, `text`, etc.). Infer role from the variable name when not explicit.
   - **Typography** — font families, weights, sizes (xs..6xl or numeric), line-heights, letter-spacing.
   - **Spacing** — numeric scale (px or rem), with usage hints (gutter, inset, stack).
   - **Radii** — name + value + role (button, card, pill).
   - **Shadows** — name + value + role (elevation level, focus ring).
   - **Breakpoints** — name + min-width value + intent (mobile, tablet, desktop, wide).
4. Decide write strategy. Check whether `artifacts/design/design-tokens.md` already exists:
   - **Auto mode** (project `Autonomy: auto` in `CLAUDE.md` — assume true unless explicitly told otherwise): rename the existing file to `design-tokens.md.bak` first (overwriting any prior `.bak`), then write the new artifact.
   - **Interactive mode**: present the proposed content as a diff/append and ask the user before writing.
5. Compose the artifact with the structure below. Each section gets a D-ID stub on its heading line so a human can replace `D-?` with a real decision ID when the token group is formally adopted.

```markdown
# Design Tokens

**Source**: <path supplied via $ARGUMENTS>
**Captured**: <YYYY-MM-DD>
**Format**: <css | scss | tailwind | json>

> Each token group below is a candidate BMAD decision. Replace `D-?` with a real
> D-ID once the group is logged in `artifacts/context/decision-log.md`.

## Colors  <!-- D-? -->

| Name | Value | Role / Usage |
|---|---|---|
| `--color-primary-500` | `#2563EB` | Primary action, link, focus ring |
| ... | ... | ... |

## Typography  <!-- D-? -->

| Name | Value | Role / Usage |
|---|---|---|
| `--font-sans` | `Inter, system-ui, sans-serif` | Default UI font |
| `--text-base` | `1rem / 1.5` | Body copy |
| ... | ... | ... |

## Spacing  <!-- D-? -->

| Name | Value | Role / Usage |
|---|---|---|
| `--space-1` | `4px` | Tight inset, icon gap |
| ... | ... | ... |

## Radii  <!-- D-? -->

| Name | Value | Role / Usage |
|---|---|---|
| `--radius-sm` | `4px` | Inputs, tags |
| ... | ... | ... |

## Shadows  <!-- D-? -->

| Name | Value | Role / Usage |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,0.06)` | Resting card |
| ... | ... | ... |

## Breakpoints  <!-- D-? -->

| Name | Min-width | Intent |
|---|---|---|
| `sm` | `640px` | Tablet |
| `md` | `768px` | Small desktop |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Wide |

## Notes

- Token names are preserved verbatim from the source file.
- Roles are inferred; review and correct before promoting any group to a real D-ID.
- Re-run `/bmad-ui:design-tokens <source>` whenever the source file changes; the
  prior version will be backed up to `design-tokens.md.bak` in auto mode.
```

6. Write to `artifacts/design/design-tokens.md` (creating parent directories as needed). Report the path and the count of tokens extracted per group.

## Notes

- This skill writes exactly one artifact (`artifacts/design/design-tokens.md`) plus an optional `.bak` of the prior version. It does not edit the source file.
- If the source is a Tailwind config, prefer values under `theme.extend` and recognize Tailwind's default scale (e.g. `text-xs..6xl`, `space-0..96`) when keys are absent.
- If the source is a JSON design-token document (Style Dictionary or Figma Tokens-style), traverse the `$value`/`value` keys; preserve the original group nesting under `Role / Usage`.
- Do not invent values not present in the source. When a group is empty (e.g. no shadows defined), keep the section header with a single `_(none defined)_` row.
