# System Prompt Replacement for Pure Orchestrator Identity

**Date**: 2026-02-23
**Author**: Researcher agent (researcher-2)
**Task**: Evaluate whether fully replacing Claude Code's default system prompt is beneficial for a pure orchestrator role.

---

## Executive Summary

**Recommendation: Do NOT fully replace the system prompt. Use `--append-system-prompt` (current approach) and focus on reducing bmad-swarm's own prompt bloat instead.**

Full system prompt replacement is technically possible but is the wrong optimization target. The real wins come from fixing the ~2,065 tokens of irrelevant orchestrator rules that leak into every worker agent, not from stripping Claude's base prompt from the orchestrator. The base prompt is small (~269 tokens for the core identity), provides genuine value for tool usage quality, and its removal creates risks that outweigh the token savings.

---

## 1. What Does Claude Code's Default System Prompt Actually Contain?

### Architecture

Claude Code does NOT have a single monolithic system prompt. It assembles 110+ dynamically-selected strings based on context. The key components, per the [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) repository (v2.1.50, Feb 20 2026):

| Component Category | Approx. Tokens | Relevance to Orchestrator |
|---|---|---|
| **Main identity prompt** | ~269 | LOW -- "You are an interactive CLI tool" framing |
| **Tool descriptions** (25+ tools) | ~15,000+ | HIGH -- includes TeamCreate, SendMessage, Task, TaskCreate, etc. |
| **Behavioral guidelines** | ~8,000 | MIXED -- some useful (safety, reasoning), some not (code style) |
| **System reminders** (40+ context-specific) | ~6,000 | LOW-MEDIUM -- mostly contextual, loaded conditionally |
| **Agent/sub-agent prompts** | ~12,000 | MEDIUM -- teammate creation and coordination instructions |
| **Utility agents** | ~8,000 | LOW -- summarization, session management |

**Key insight**: The main identity ("You are a coding assistant") is only ~269 tokens. The vast majority of the default system prompt is tool descriptions and behavioral guidelines, not identity framing.

### What the Orchestrator Actually Sees

When bmad-swarm runs `claude --append-system-prompt .claude/system-prompt.txt`:

1. Claude's full default system prompt loads (~15,000-25,000+ tokens, depending on which conditional components activate)
2. The `.claude/rules/` files load as system-level instructions (~2,743 tokens, all 4 files)
3. The `system-prompt.txt` content appends (~372 tokens)
4. The `CLAUDE.md` content loads as user-level instructions (~245 tokens)

**Total orchestrator context**: ~18,000-28,000+ tokens before the first user message.

---

## 2. What Does the Orchestrator Actually Need?

### Tools the Orchestrator Uses

| Tool | Used By Orchestrator? | In Default Prompt? |
|---|---|---|
| TeamCreate | YES (critical) | YES |
| SendMessage | YES (critical) | YES |
| TaskCreate / TaskUpdate / TaskList / TaskGet | YES (critical) | YES |
| Read | YES (for quick lookups) | YES |
| Bash | Occasionally (git status, etc.) | YES |
| Glob / Grep | Rarely | YES |
| Edit / Write | NO (delegates to developers) | YES |
| WebSearch / WebFetch | NO (delegates to researcher) | YES |

### What the Orchestrator Genuinely Needs from the Base Prompt

1. **Tool descriptions for TeamCreate, SendMessage, Task tools** -- These contain the API contract (parameters, behavior, constraints). Without them, Claude would have to infer tool usage from schema alone.
2. **Basic safety behaviors** -- Not all safety rules are coding-specific. The base prompt includes protections against generating harmful content, prompt injection awareness, and authorization verification.
3. **General reasoning quality** -- The behavioral guidelines include instructions about task decomposition, planning, and avoiding premature actions. These are relevant to an orchestrator.
4. **Git safety protocols** -- The orchestrator may occasionally need to check git status or understand the repository state.

### What the Orchestrator Does NOT Need

1. **"You are a coding assistant" identity framing** (~269 tokens) -- The orchestrator is NOT a coding assistant. However, this identity is overridden effectively by the system-prompt.txt and rules files.
2. **Code editing tool usage instructions** (Edit, Write, etc.) (~2,000+ tokens) -- The orchestrator never edits files.
3. **Bash safety rules for code execution** (~500+ tokens) -- The orchestrator rarely runs commands.
4. **Code style and formatting guidelines** (~1,000+ tokens) -- Irrelevant to orchestration.
5. **File operation instructions** (Read vs cat, Edit vs sed, etc.) (~1,000+ tokens) -- The orchestrator does minimal file operations.

**Estimated unnecessary content in base prompt**: ~5,000-7,000 tokens of content irrelevant to the orchestrator role.

---

## 3. What Are the Real Risks of Full Replacement?

### Risk 1: Tool Usage Quality Degradation (HIGH RISK)

The default system prompt contains detailed tool descriptions with usage examples, parameter explanations, and behavioral notes. Per the [official Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts):

> "Custom systemPrompt: Default tools -- **Lost (unless included)**. Built-in safety -- **Must be added**. Environment context -- **Must be provided**."

If you replace the system prompt, you must **re-include all tool descriptions** you want Claude to use well. These alone are ~15,000+ tokens. You save nothing on tools.

Claude can technically use tools from their JSON schemas alone, but the behavioral guidance in the system prompt significantly improves tool selection, parameter usage, and error handling. Without the prompt telling Claude "use Read instead of cat", it will fall back to less optimal patterns.

### Risk 2: TeamCreate and Agent Coordination (HIGH RISK)

The agent teammate creation and coordination instructions are embedded in the base system prompt. These describe how to spawn teammates, how to communicate via SendMessage, and how idle waiting works. bmad-swarm's orchestrator rules DEPEND on these base instructions working correctly.

Replacing the system prompt means you must rewrite or replicate all team coordination instructions. Any gaps could cause the orchestrator to misuse TeamCreate or fail to communicate properly with spawned agents.

### Risk 3: Safety Behavior Removal (MEDIUM RISK)

The base prompt includes safety behaviors that are not all coding-specific:
- Prompt injection awareness
- Authorization verification
- Reversibility assessment before destructive actions
- Security vulnerability awareness

Removing these and relying solely on the model's training may lead to degraded safety behavior.

### Risk 4: Practical Impossibility in Interactive Mode (BLOCKING)

The [GitHub issue #2692](https://github.com/anthropics/claude-code/issues/2692) requesting full system prompt replacement in interactive mode was **closed as NOT_PLANNED** by the Claude Code maintainers (Feb 19, 2026).

Current state:
- `--system-prompt` flag: **Works in both interactive and print modes** (confirmed in CLI reference)
- `--system-prompt-file` flag: **Print mode only**

So full replacement IS technically possible in interactive mode via `--system-prompt`, but:
- You must include ALL tool descriptions, safety rules, and coordination instructions yourself
- You lose all future improvements to Claude Code's default prompt
- You must maintain your custom prompt as Claude Code evolves

### Risk 5: Maintenance Burden (HIGH RISK)

Claude Code updates its system prompt with every release. The [Piebald-AI repo](https://github.com/Piebald-AI/claude-code-system-prompts) tracks changes and shows frequent updates. A fully custom system prompt would need to be updated in lockstep with Claude Code releases or risk:
- Breaking when new tools are added
- Missing safety improvements
- Losing performance optimizations

---

## 4. Token Impact Analysis

### Current State (append approach)

| Component | Tokens |
|---|---|
| Claude Code base prompt (estimated active) | ~18,000-25,000 |
| bmad-swarm system-prompt.txt | ~372 |
| bmad-swarm rules (all 4 files) | ~2,743 |
| CLAUDE.md | ~245 |
| **Total orchestrator initial context** | **~21,000-28,000** |

### Full Replacement (hypothetical)

| Component | Tokens |
|---|---|
| Lean orchestrator identity | ~500 |
| Tool descriptions (must keep: TeamCreate, SendMessage, Task tools, Read, Bash) | ~8,000 |
| Safety and coordination behaviors (must keep) | ~2,000 |
| bmad-swarm orchestrator rules (merged) | ~2,500 |
| CLAUDE.md | ~245 |
| **Total orchestrator initial context** | **~13,000-14,000** |

### Savings

**Theoretical maximum savings**: ~7,000-14,000 tokens (~33-50% reduction)

But this requires:
- Manually maintaining ~10,500 tokens of tool and safety content
- Tracking every Claude Code release for changes
- Re-testing tool usage quality after each update
- Accepting degradation risk when your custom prompt drifts from the official one

### Better Alternative: Fix bmad-swarm's Own Bloat

Per the [token-optimization.md](../exploration/token-optimization.md) research from the other researcher, bmad-swarm wastes ~2,065 tokens per worker agent on irrelevant orchestrator rules. Fixing this requires 2 file edits and saves ~8,260 tokens across a 5-agent team with zero risk.

---

## 5. The "Lobotomization" Question

### Is removing Claude's system prompt actually "lobotomizing" it?

**For a general-purpose coding assistant: Yes, it significantly degrades performance.** Tool usage quality drops because the behavioral guidance around tool selection, parameter usage, and error handling is lost.

**For a pure orchestrator that only uses TeamCreate, SendMessage, and Task tools: Partially.** The orchestrator does not need coding-specific guidance, but it DOES need:
- Tool descriptions for the tools it uses
- Team coordination behavior
- Safety behaviors
- General reasoning guidance

Removing the identity framing ("You are a coding assistant") and coding-specific instructions (~5,000-7,000 tokens) would be harmless or even beneficial. But you cannot do that surgically with `--system-prompt` -- it is all-or-nothing.

### The Real Answer

The question frames this as a binary: keep the whole system prompt or replace it entirely. **The right answer is neither.** The right approach is:

1. **Keep the base system prompt** (via `--append-system-prompt`, which is what bmad-swarm already does)
2. **Override the identity** in the appended prompt (which bmad-swarm already does: "You are the orchestrator")
3. **Fix bmad-swarm's own prompt bloat** (the 13,170 tokens of waste identified in the token optimization report)
4. **Use `--disallowedTools` to remove irrelevant tools** from the orchestrator's context, saving the token cost of their descriptions

---

## 6. Hybrid Option: Surgical Tool Restriction

Instead of replacing the system prompt, use `--disallowedTools` to remove tools the orchestrator never uses:

```bash
claude --append-system-prompt .claude/system-prompt.txt \
  --disallowedTools "Edit" "Write" "NotebookEdit" "WebSearch" "WebFetch"
```

Per the [CLI reference](https://code.claude.com/docs/en/cli-reference), `--disallowedTools` "removes tools from the model's context" entirely. This means their descriptions are not included in the system prompt, saving tokens without any of the risks of full replacement.

**Estimated savings from tool removal**: ~3,000-5,000 tokens (removing Edit ~1,200, Write ~800, NotebookEdit ~600, WebSearch ~500, WebFetch ~500+)

This is a clean, safe, maintainable optimization.

---

## 7. Recommendation

### Clear Answer: Do NOT replace the system prompt.

The orchestrator should continue using `--append-system-prompt`. The identity override already works ("You are the orchestrator" in system-prompt.txt effectively overrides "You are a coding assistant"). The real optimization opportunities are:

### Priority 1: Fix bmad-swarm's internal prompt bloat (HIGH IMPACT, LOW RISK)
- Move orchestrator-specific rules into the agent definition
- Deduplicate content between rules and agent files
- Remove Project Info sections from agent definitions
- **Savings**: ~13,170 tokens across a 5-agent team

### Priority 2: Use `--disallowedTools` for the orchestrator (MEDIUM IMPACT, LOW RISK)
- Remove Edit, Write, NotebookEdit, WebSearch, WebFetch from orchestrator context
- **Savings**: ~3,000-5,000 tokens per orchestrator session

### Priority 3: Do NOT pursue full system prompt replacement (NEGATIVE ROI)
- Theoretical savings: ~7,000-14,000 tokens
- But requires maintaining ~10,500 tokens of custom tool/safety content
- Creates maintenance burden on every Claude Code update
- Risks tool usage quality degradation
- Risks breaking teammate coordination
- ROI is negative when you factor in maintenance cost

---

## Sources

- [Claude Agent SDK: Modifying System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts) -- official documentation on append vs replace trade-offs
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- all system prompt flags and --disallowedTools
- [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) -- extracted system prompt components with token counts
- [GitHub Issue #2692: Replace system prompt in interactive mode](https://github.com/anthropics/claude-code/issues/2692) -- closed as NOT_PLANNED
- [Claude Code System Prompt Analysis (Weaxs)](https://weaxsey.org/en/articles/2025-10-12/) -- reverse engineering of prompt structure
- [Claude Code System Prompt Changes v2.0 (Mikhail Shilkov)](https://mikhail.io/2025/09/sonnet-4-5-system-prompt-changes/) -- tracking prompt evolution
- bmad-swarm token-optimization.md -- companion research on token waste in current prompt architecture
