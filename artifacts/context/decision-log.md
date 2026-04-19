# Decision Log

Sequential D-IDs for all decisions that affect product direction, architecture, or cross-cutting behavior. Tactical decisions get one-line entries; strategic decisions get full records. See `methodology/decision-classification.md` for classification.

## D-001 — Default permission mode is `acceptEdits`; dangerous patterns explicitly denied

- **Date:** 2026-04-16
- **Classification:** Strategic (affects permission model, visible to end user, cross-cutting)
- **Context:** User reported too many permission prompts during autonomous execution. Option C scoped the `allow` list but left default mode unset.
- **Decision:** Set `permissions.defaultMode: "acceptEdits"` in generated settings.json + template. Add explicit `permissions.deny` for destructive patterns (rm -rf, sudo, git push --force, git reset --hard, curl|sh, chmod 777).
- **Rationale:** User explicitly asked for fewer prompts. The `allow` list is narrow (Bash(npm:*), Bash(node:*), etc.) so blast radius is bounded. The orchestrator-write-gate hook still fires under acceptEdits (hook `permissionDecision: deny` overrides permission mode — empirically verified).
- **Consequences:** Fewer prompts for in-scope work; explicit denies for high-impact destructive patterns; delegate-everything rule preserved via hook.
- **Alternatives considered:** `bypassPermissions` (rejected — skips deny list); expand allow list (rejected — endless enumeration).
- **ADR:** `artifacts/design/decisions/adr-001-permission-default-mode.md`
- **Referenced by:** `templates/settings.json.template`, `.claude/settings.json`, `templates/CLAUDE.md.template`

## D-002 — Delete the `TaskCompleted` hook; do not rewire to `Stop`/`SubagentStop`

- **Date:** 2026-04-16
- **Classification:** Strategic (touches hook surface, enforcement story, and security posture)
- **Context:** Audit 2026-04-16 B-1: the `TaskCompleted` hook is registered against a Claude Code event that does not exist. The hook's 40 LOC (generator + settings entry + hook file) never execute. Reviewer offered delete vs rewire-to-Stop/SubagentStop.
- **Decision:** Delete `generateTaskCompletedHook`, drop it from `getHooksConfig()` and the `generateHooks()` loop, regenerate `.claude/`, and note the removal in CHANGELOG.
- **Rationale:** (a) The hook is advisory-only (`enforce: false` default), so its absence changes no observable behavior — the developer's TDD workflow + reviewer adversarial pass already gate merge. (b) `Stop`/`SubagentStop` payloads do not carry `TASK_SUBJECT`/`TASK_OWNER`; a correct rewire requires inventing a trigger (read task list on stop, correlate with session, filter by role), which is expensive for an advisory signal. (c) Deletion closes security L-2 (the advisory `npm test` code-execution chain, coupled with M-1 `Bash(npm:*)` allow) permanently. (d) The feature can be re-added later as a real orchestrator-side design if value is proven.
- **Consequences:** 40 LOC removed; L-2 closed; A-1 (dead `taskId`) eliminated as a side effect. One less hook to test (reduces B-3 coverage gap). CHANGELOG 2.0.0 claim about auto-test-run becomes accurate under a 2.0.1 correction.
- **Alternatives considered:** Rewire to `Stop`/`SubagentStop` (rejected — inventing a trigger is high cost for zero enforcement value); leave dormant (rejected — the `_bmadGenerated` hash covers the dead section and the presence misleads readers of `settings.json`).
- **ADR:** `artifacts/design/decisions/adr-002-taskcompleted-hook-disposition.md`
- **Referenced by:** `generators/hooks-generator.js`, `.claude/settings.json` (post-regeneration), `CHANGELOG.md`

## D-003 — Orchestrator-write-gate: keep with two-layer identity check (agent_id/agent_type + AGENT_ROLE env)

- **Date:** 2026-04-18
- **Classification:** Strategic (affects the structural enforcement of a core CLAUDE.md invariant; cross-cutting across teammate workflow, permission model, and hook design).
- **Context:** HARN-1 (2026-04-16) — `orchestrator-write-gate.cjs` fires on teammates because in-process TeamCreate subagents inherit `AGENT_ROLE=orchestrator` from the parent env, falsifying the hook's design-time assumption that "fresh teammate sessions don't inherit this env." The only in-session recovery was a `settings.local.json` override that disabled the gate for the orchestrator too. Task #1 of team `gate-and-brainstorm-eval` asked (a) whether the gate should exist at all, (b) if kept, how to fix the identity check permanently.
- **Decision:** Keep the gate. Redesign the identity check as a two-layer test: (1) `event.agent_id || event.agent_type` from the Claude Code hook payload — documented as the main-thread vs. subagent discriminator — exits pass-through when either is present; (2) `process.env.AGENT_ROLE === 'orchestrator'` retained as defense-in-depth so the existing `settings.local.json` recovery path still works. Allow-list extended with `.claude/settings.local.json` to close a legitimate-orchestrator-write false positive surfaced during HARN-1 triage.
- **Rationale:** The invariant "orchestrator does not edit code" is load-bearing (adversarial review, decision traceability, test coverage are keyed off it) and prose-only enforcement has failed before. The payload fields are Anthropic's documented signal for the question we are asking; they are independent of env-inheritance behavior, which is the actual bug. Two-layer design fails safe (degrades to pre-gate state) rather than failing open (the HARN-1 false-positive mode that blocked teammate work).
- **Consequences:** HARN-1 closed permanently. L-1 (single-layer identity check) downgraded — gate now has two independent signals. The `AGENT_ROLE: ""` local override can be removed from `settings.local.json`. Adds dependency on an experimental Claude Code payload field (mitigated by process-spawn hook tests that break loudly on field-name drift). Six new test cases in `test/hooks.test.js`, including a regression guard for the main-thread-plus-orchestrator-env case that would have caught HARN-1 itself.
- **Alternatives considered:** Blocklist redesign (rejected — adversarial-complete, re-enumerates the project tree); advisory-only demotion (rejected — regresses to prose-only failure mode); remove entirely (rejected — resurrects the failure that motivated the gate); per-edit LLM classifier (rejected — deterministic allow-list already encodes the classification at zero runtime cost); transcript_path / session_id / PPID discrimination (rejected — in-process teammates share all three with the parent); positive teammate env marker (rejected — no such marker is set by Claude Code for in-process subagents).
- **ADR:** `artifacts/design/decisions/adr-003-orchestrator-write-gate-design.md`
- **Referenced by:** `generators/hooks-generator.js` (patch site for `generateOrchestratorWriteGateHook`), `.claude/hooks/orchestrator-write-gate.cjs` (regenerated post-fix), `test/hooks.test.js` (new cases), `artifacts/context/findings-register.md` HARN-1 (pending resolution), `CLAUDE.md` §Permission model.

## D-BRN-1 — `/brainstorm` is an orchestrator-overlay process step, not a teammate spawn

- **Date:** 2026-04-18
- **Classification:** Strategic (changes slash-command behavior, reframes "orchestrator never does work" invariant)
- **Context:** `/brainstorm` previously spawned an ideator teammate. Teammates have no direct human channel — the only way they "converse" with the user is SendMessage-relay through the orchestrator, which kills conversational turn-taking.
- **Decision:** `/brainstorm` tells the orchestrator to load `agents/ideator.md` in full and run the conversation directly in its own session (no teammate spawn). Produces a lightweight summary at `artifacts/planning/brainstorm-<topic-slug>-<YYYY-MM-DD>.md` on exit.
- **Rationale:** Overlay pattern restores the conversational substrate. Framed as an orchestrator process step (parallel to the retrospective step), so the "never do work" invariant stays intact — brainstorming is coordination/reasoning, not implementation work.
- **Alternatives considered:** Keep team spawn and tune ideator prompt (rejected — doesn't fix relay latency); build sync human↔teammate IPC (rejected — substrate change, out of scope); delete `/brainstorm` (rejected — loses the 17-technique toolkit).
- **Referenced by:** `generators/commands-generator.js` (`buildBrainstormBody`), `agents/orchestrator.md` (§Brainstorming as process step), `agents/ideator.md`, `methodology/orchestration-modes.md`

## D-BRN-2 — Brainstorm output is a lightweight summary, not a full product brief

- **Date:** 2026-04-18
- **Classification:** Tactical (output artifact shape)
- **Decision:** Summary template: topic, key decisions with D-IDs, open questions, recommended next step. Path: `artifacts/planning/brainstorm-<topic-slug>-<YYYY-MM-DD>.md`. Full product brief (requirements, personas, success metrics) remains the strategist phase's deliverable.
- **Rationale:** Keeps the orchestrator out of downstream-artifact production; preserves strategist ownership of the PRD-grade product brief.
- **Referenced by:** `agents/ideator.md`, `agents/orchestrator.md`

## D-BRN-3 — Reframe `ideator.md` as a role identity, not a Mode-A teammate

- **Date:** 2026-04-18
- **Classification:** Tactical (role-file framing)
- **Decision:** `agents/ideator.md` reframed as a role identity usable in two contexts: overlay mode (default — loaded by the orchestrator) or teammate spawn mode (rare — bulk ideation with no live human conversation). Keep the full toolkit (Four Lenses, 17 techniques, elicitation methods, adaptive interaction rules).
- **Rationale:** The file's content is correct; only the wrapper framing was wrong. Minimal edits: top paragraph + overlay-specific Behavioral Rules at the top of the rules section.
- **Referenced by:** `agents/ideator.md`

## D-BRN-4 — `/explore-idea` (Mode B) ships alongside `/brainstorm`

- **Date:** 2026-04-18
- **Classification:** Tactical (sequencing, command inventory)
- **Decision:** `/explore-idea` — ideator overlay in the orchestrator session PLUS researcher spawned in parallel for evidence gathering. Strategist's eval deferred it, but the overlay pattern lands in the same release, so `/explore-idea` is tractable immediately.
- **Rationale:** Mode B lacks Mode A's substrate problem (researcher gathers evidence autonomously, no live human conversation needed). Natural extension; low marginal cost once overlay exists.
- **Referenced by:** `generators/commands-generator.js` (new `buildExploreIdeaBody`), `agents/orchestrator.md`
