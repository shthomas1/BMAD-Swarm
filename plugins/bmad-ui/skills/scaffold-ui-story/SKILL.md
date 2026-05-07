---
name: scaffold-ui-story
description: Scaffold a UI-flavored BMAD story file at artifacts/implementation/stories/story-<id>.md with extra sections for visual states, accessibility AC, browser support, and responsive breakpoints. Use when the user invokes /bmad-ui:scaffold-ui-story <story-id> "<title>".
allowed-tools: Read Grep Glob Bash Write
---

# Scaffold UI Story

Create a UI-aware story file that extends the standard BMAD story schema with the sections every interface story needs: visual states, accessibility AC, browser support, responsive breakpoints.

## Inputs

`$ARGUMENTS` — `<story-id> "<title>"`. Both required.

- `<story-id>`: e.g. `1.4`, `2.10`, `auth-3` — used as the filename suffix.
- `<title>`: free-form title in double quotes.

If either is missing, ask the user for both, then stop.

## Dynamic context

- Existing tokens artifact: !`type artifacts\design\design-tokens.md 2>nul || cat artifacts/design/design-tokens.md 2>/dev/null`
- Existing component specs: !`dir /b artifacts\design\components 2>nul || ls artifacts/design/components 2>/dev/null`
- Existing story file (refusal check): !`type "artifacts\implementation\stories\story-<id>.md" 2>nul || cat "artifacts/implementation/stories/story-<id>.md" 2>/dev/null`

## What you do (Claude)

1. Parse `$ARGUMENTS` into `id` and `title`. If either is missing, ask the user, then stop.
2. Compute the target path: `artifacts/implementation/stories/story-<id>.md`.
3. **Refuse to overwrite.** If the target file already exists, report the path and tell the user to remove or rename it before re-running. Do not write anything.
4. If `artifacts/design/design-tokens.md` exists, read it and collect the top-level token group names (`Colors`, `Typography`, `Spacing`, `Radii`, `Shadows`, `Breakpoints`) plus a small sample of token names per group. Embed this list under `### Available tokens` in Dev Notes.
5. Compute `slug = kebab-case(title)`. If `artifacts/design/components/<slug>.md` exists, link to it from Dev Notes under `### Related component spec`.
6. Compose the file with the structure below. Sections must appear **in this exact order**:

```markdown
# Story <id>: <title>

## Status: draft

## Domain: ui

## User Story

As a [specific user type],
I want [specific capability],
So that [specific benefit].

## Acceptance Criteria

### AC1: <happy path title>
**Given** [specific precondition]
**When** [specific action]
**Then** [specific expected outcome]

### AC2: <error path title>
**Given** [specific precondition]
**When** [specific action]
**Then** [specific expected outcome]

## Visual States

- **Default**: ...
- **Hover**: ...
- **Focus**: ...
- **Disabled**: ...
- **Loading**: ...
- **Error**: ...

## Accessibility AC

- [ ] Keyboard navigable (tab order documented in Dev Notes)
- [ ] Screen-reader labels (aria-label or visible text on every interactive element)
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 body, 3:1 large/UI)
- [ ] Focus indicators visible (no `outline: none` without a replacement)
- [ ] Respects `prefers-reduced-motion` (no motion-triggered seizure risk)

## Browser Support

- Chromium >= 120
- Firefox >= 120
- Safari >= 17
- Mobile Safari iOS 17+

## Responsive Breakpoints

- **Mobile** (< 640px): ...
- **Tablet** (640-1024px): ...
- **Desktop** (> 1024px): ...

## Tasks

- [ ] Task 1: ...
- [ ] Task 2: ...
- [ ] Task 3: Write tests for ...

## Dev Notes

### Architecture Context
...

### Technical Implementation
...

### File Locations
- Component path: ...
- Test path: ...

### Available tokens
<!-- Auto-populated from artifacts/design/design-tokens.md when present. -->
- Colors: <sample names or "(no design-tokens.md found)">
- Typography: ...
- Spacing: ...
- Radii: ...
- Shadows: ...
- Breakpoints: ...

### Related component spec
<!-- Auto-linked when artifacts/design/components/<slug>.md exists. -->
- See `artifacts/design/components/<slug>.md`

### Related D-IDs
- D-?

### Anti-Patterns
- Do not use `outline: none` without a visible replacement focus ring.
- Do not gate functionality behind hover-only affordances (touch + keyboard must reach it too).
- Do not hard-code colors / spacing — reference the design-tokens artifact above.
```

7. Write the file. Report the absolute path and which optional cross-links were embedded (tokens / component spec).

## Notes

- The 9 required top-level sections (Status, Domain, User Story, Acceptance Criteria, Visual States, Accessibility AC, Browser Support, Responsive Breakpoints, Tasks, Dev Notes) must always appear, even when stubbed.
- The Accessibility AC section ships with **exactly the five default checkboxes** above. Add story-specific items by appending to the list, never by replacing the defaults.
- The 6 Visual States (Default / Hover / Focus / Disabled / Loading / Error) are mandatory; if a state is genuinely not applicable, leave it as `n/a` rather than removing the bullet.
- Preserve the file format used elsewhere in `artifacts/implementation/stories/` (UTF-8, fenced code blocks, BDD `Given/When/Then` lines).
