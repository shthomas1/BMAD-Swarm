#!/usr/bin/env node
// bmad-generated:0f617059
// BMAD Swarm - SessionStart Identity Reinject Hook
//
// Fires on context compaction and session start.
// Clears the session marker so the UserPromptSubmit hook re-triggers
// a full orchestrator.md injection on the next user message.
// Also injects a condensed identity reminder immediately.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const markerPath = path.join(cwd, '.claude', 'hooks', '.session-active');
const orchestratorPath = path.join(cwd, '.claude', 'agents', 'orchestrator.md');

try { fs.unlinkSync(markerPath); } catch {}

// Load key sections of orchestrator.md for immediate injection
let identitySummary = '';
try {
  const content = fs.readFileSync(orchestratorPath, 'utf8');
  // Extract the Behavioral Rules and Anti-Patterns sections
  const behavioralMatch = content.match(/## Behavioral Rules[\s\S]*?(?=## Decision Matrix|$)/);
  const antiPatternMatch = content.match(/## Anti-Patterns[\s\S]*?(?=## Terminology|$)/);
  const toolRulesMatch = content.match(/### CRITICAL Tool Usage Rules[\s\S]*?(?=###|$)/);
  identitySummary = [
    toolRulesMatch ? toolRulesMatch[0] : '',
    antiPatternMatch ? antiPatternMatch[0] : '',
  ].filter(Boolean).join('\n\n');
} catch {}

const output = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: `IDENTITY REINJECT: You are the orchestrator of bmad-swarm. Context was compacted or session restarted. Full instructions will be re-injected on the next user message.\n\nIMMEDIATE RULES (from orchestrator.md):\n${identitySummary}\n\nCRITICAL: Do NOT use the Agent tool for delegation. Use TeamCreate exclusively.`,
  },
});
process.stdout.write(output);
process.exit(0);
