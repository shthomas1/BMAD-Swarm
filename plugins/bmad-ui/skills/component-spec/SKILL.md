---
name: component-spec
description: Convert a Figma frame description, screenshot description, or freeform UI brief into a structured component spec artifact at artifacts/design/components/<name>.md (props, variants, states, slots, accessibility). The design counterpart to a story. Use when the user invokes /bmad-ui:component-spec "<component name>".
allowed-tools: Read Grep Glob Bash Write
---

# Component Spec

Capture a UI component as a first-class design artifact: typed props, variants, visual states, slots, behavior, accessibility, and the design tokens it consumes.

## Inputs

`$ARGUMENTS` — component name (required). Examples: `Button`, `PrimaryNav`, `OrderSummaryCard`. Free-form; the skill kebab-cases it for the filename.

If `$ARGUMENTS` is empty, ask the user for a component name, then stop.

## Dynamic context

- Existing tokens artifact: !`type artifacts\design\design-tokens.md 2>nul || cat artifacts/design/design-tokens.md 2>/dev/null`
- Existing component specs: !`dir /b artifacts\design\components 2>nul || ls artifacts/design/components 2>/dev/null`

## What you do (Claude)

1. Parse `$ARGUMENTS` into a component name. Compute `slug = kebab-case(name)` and target path `artifacts/design/components/<slug>.md`.
2. Ask the user for the source material — present these options in one prompt:
   - A Figma frame URL or description
   - A screenshot (path or description)
   - A freeform text brief (purpose, key states, key props)
3. Wait for the user reply. Synthesize a spec from whatever they provide.
4. If the target file already exists, refuse to overwrite. Report the path and ask the user to remove or rename it first.
5. If `artifacts/design/design-tokens.md` exists, read its top-level group names so the **Related Tokens** section can cross-link real token names rather than placeholders.
6. Compose the artifact with the structure below:

```markdown
# Component: <Name>

**Slug**: `<slug>`
**Captured**: <YYYY-MM-DD>
**Source**: <Figma URL | screenshot description | text brief>

## Purpose

One paragraph: what this component is, when to use it, when *not* to use it.

## Props

| Prop | Type | Default | Required | Description |
|---|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'primary'` | no | Visual variant. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | no | Size scale. |
| `disabled` | `boolean` | `false` | no | Disables interaction. |
| `onClick` | `(e: MouseEvent) => void` | -- | yes | Click handler. |

## Variants

| Variant | Use case | Visual notes |
|---|---|---|
| `primary` | Primary action on a screen | Solid fill with brand color |
| `secondary` | Supporting action | Outlined, neutral fill |
| `ghost` | Tertiary, low-emphasis | No border, no fill |

## Visual States

- **Default**: ...
- **Hover**: ...
- **Focus**: ... (visible focus ring; do not remove `outline` without a replacement)
- **Active / Pressed**: ...
- **Disabled**: ...
- **Loading**: ...
- **Error**: ...

## Slots

| Slot | Purpose |
|---|---|
| `children` | Primary label / content |
| `leadingIcon` | Optional icon before children |
| `trailingIcon` | Optional icon after children |

## Behavior

- Trigger conditions, async behavior, focus management on open/close, debounce/throttle rules.
- Interaction with parent forms (submit, validation propagation).
- Side effects (analytics events, navigation).

## Accessibility

- **Role**: `<implicit role or explicit role="...">`
- **Keyboard**: Enter/Space activate; Esc to dismiss when overlay; Tab order documented.
- **Screen reader**: aria-label / aria-labelledby strategy; live-region usage for async state.
- **Contrast**: foreground on every background variant must meet WCAG 2.1 AA (4.5:1 body, 3:1 large/UI).
- **Reduced motion**: respect `prefers-reduced-motion`; document any motion that must be suppressed.

## Related Tokens

Cross-reference `artifacts/design/design-tokens.md`. List the specific tokens this component consumes:

- Colors: `<token names>`
- Typography: `<token names>`
- Spacing: `<token names>`
- Radii: `<token names>`
- Shadows: `<token names>`

## Related D-IDs

- D-? (link the decision that established this component, once logged in `artifacts/context/decision-log.md`)
```

7. Write the file. Report the absolute path and the number of props/variants/states captured.

## Notes

- This skill writes exactly one artifact (`artifacts/design/components/<slug>.md`). It never edits source code, design tokens, or story files.
- The Visual States list above is the canonical superset; if a state is genuinely not applicable (e.g. a static heading has no Hover), keep the bullet and mark it `n/a` rather than removing it.
- When the user supplies only a brief, infer reasonable defaults but mark inferred fields with a trailing `(inferred)` so a designer can confirm later.
