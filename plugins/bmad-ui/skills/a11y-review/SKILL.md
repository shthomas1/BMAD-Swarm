---
name: a11y-review
description: Heuristic accessibility audit of an HTML file, JSX/TSX file, or live URL. Spots common WCAG 2.1 AA violations (missing alt, unlabeled inputs, div-as-button, tabindex misuse, missing lang, heading gaps, etc.) and writes a categorized report to artifacts/reviews/a11y-review-<basename>.md. Use when the user invokes /bmad-ui:a11y-review <path-or-url>.
allowed-tools: Read Grep Glob Bash Write
---

# A11y Review

Heuristic accessibility audit. Pure-Markdown skill — Claude reads the source and applies the checklist below; no headless browser, no axe-core. Findings are mapped to specific WCAG 2.1 AA criteria with concrete fix recommendations.

## Inputs

`$ARGUMENTS` — file path **or** URL. Required.

If `$ARGUMENTS` is empty, ask the user for a target, then stop.

## Dynamic context

- Source file (when a path is supplied): !`type "$ARGUMENTS" 2>nul || cat "$ARGUMENTS" 2>/dev/null`

## What you do (Claude)

1. Resolve `$ARGUMENTS`:
   - If it looks like a URL (`http://` or `https://`), use the `WebFetch` tool to retrieve the page content. **Only if `WebFetch` is genuinely available in this session** — otherwise, ask the user to paste the rendered HTML and stop.
   - Otherwise, treat it as a file path. Read with the Read tool. If the file does not exist, report and stop.
2. Compute `basename` = the filename without extension (or the URL host + last path segment for URLs). Sanitize to kebab-case for the output path.
3. Walk the source applying the heuristic checklist below. For each issue, capture: severity, the exact line snippet, the WCAG 2.1 AA success criterion, and a concrete fix.
4. Compose the report with the structure shown, then write to `artifacts/reviews/a11y-review-<basename>.md` (creating parent directories as needed).

## Heuristic checklist

| # | Heuristic | Severity | WCAG |
|---|---|---|---|
| H1 | `<img>` without `alt=` (or `alt` only on decorative images that need an empty `alt=""`) | Critical | 1.1.1 |
| H2 | `<input>` / `<select>` / `<textarea>` without an associated `<label>`, `aria-label`, or `aria-labelledby` | Critical | 1.3.1, 4.1.2 |
| H3 | `<div>` / `<span>` with `onClick` (or analogous) but no `role="button"` and no keyboard handler (`onKeyDown`/`onKeyUp` on Enter/Space) | Critical | 2.1.1, 4.1.2 |
| H4 | `<a>` without an `href` (or with `href="#"` and no JS-driven nav semantics) | Major | 2.1.1, 4.1.2 |
| H5 | `tabindex` greater than `0` | Major | 2.4.3 |
| H6 | `outline: none` (or `outline: 0`) without a visible replacement focus indicator on the same selector | Critical | 2.4.7 |
| H7 | Heading hierarchy gap (e.g. `<h1>` followed directly by `<h3>` with no `<h2>`) | Major | 1.3.1, 2.4.6 |
| H8 | `<html>` element missing a `lang=` attribute | Major | 3.1.1 |
| H9 | Form control with placeholder used as the only label (no `<label>` / `aria-label`) | Major | 1.3.1, 3.3.2 |
| H10 | Interactive control with `aria-hidden="true"` | Critical | 4.1.2 |
| H11 | Button or link with no accessible name (empty content, no `aria-label`, icon-only without `aria-label`) | Critical | 2.4.4, 4.1.2 |
| H12 | `<table>` used for layout (no `<caption>`, no `<th scope=>`, presentational role missing) | Minor | 1.3.1 |
| H13 | Auto-playing audio/video without a pause control | Major | 1.4.2 |
| H14 | Animation/transition without a `prefers-reduced-motion` guard | Minor | 2.3.3 |
| H15 | Color used as the **only** indicator of state (e.g. red text alone signals an error) | Major | 1.4.1 |

Severity scale:

- **Critical** — directly blocks a user with a disability from completing the task; must fix before merge.
- **Major** — significantly degrades the experience; fix before release.
- **Minor** — usability/quality issue; address when practical.

## Report structure

```markdown
# A11y Review: <basename>

**Source**: <path or URL>
**Reviewed**: <YYYY-MM-DD>
**Reviewer**: /bmad-ui:a11y-review (heuristic)

## Summary

- Total findings: <N>
- Critical: <C>
- Major: <M>
- Minor: <m>
- Verdict: PASS (no Critical/Major) | FAIL (>=1 Critical or Major)

## Findings

| Severity | Issue | Location | WCAG | Suggested fix |
|---|---|---|---|---|
| Critical | Image missing alt | `Hero.tsx:24` | 1.1.1 | Add `alt="Brief description of the image"`; use `alt=""` only if the image is purely decorative. |
| Major | Heading gap (h1 -> h3) | `Page.tsx:12-30` | 1.3.1, 2.4.6 | Insert an `<h2>` between the page title and the section subheading, or downgrade the `<h3>` to an `<h2>`. |
| Minor | Animation without reduced-motion guard | `styles.css:88` | 2.3.3 | Wrap the keyframe rule in `@media (prefers-reduced-motion: no-preference) { ... }`. |

## Notes

- This is a heuristic review; some Critical findings may be false positives if context (e.g. an off-screen label) is hidden from a static read. Confirm before fixing.
- Re-run after fixes to verify resolution.
```

## What to do when the source is JSX/TSX

- Recognize prop spelling differences from raw HTML: `htmlFor` (not `for`), `tabIndex` (not `tabindex`), `aria-*` attributes are unchanged.
- Treat `<Image>` (Next.js) and `<img>` identically for H1.
- For H3 (div-as-button), look for `onClick` without a sibling `onKeyDown`/`onKeyUp` and without `role="button"`.

## What to do when the source is a URL

- Use `WebFetch` only if it is available in the current tool list. The tool name appears at the top of the prompt or as a deferred tool — never assume.
- If `WebFetch` is not available, tell the user to either:
  - Paste the rendered HTML into the chat, then re-run; or
  - Save the page as an `.html` file and pass that path instead.

## Notes

- Read-only on the source. Writes exactly one artifact: `artifacts/reviews/a11y-review-<basename>.md`.
- Do not invent findings. If the file is clean, produce a report with `Total findings: 0` and `Verdict: PASS`.
- Always include line numbers (or line ranges) in the `Location` column. If the source is a URL, use a structural locator (e.g. `<header> nav <a> #3`).
