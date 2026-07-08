// ============================================================
// Prompt templates — for Agent instruction generation
// Each template takes structured context and returns a prompt
// that asks the LLM for concrete, executable Agent instructions
// ============================================================
import type { ProjectContext } from './context-parser';

export interface AgentSpec {
  role: string;
  label: string;
  agent: string;
  description: string;
}

export interface GeneratedAgent {
  label: string;
  agent: string;
  role: string;
  description: string;
  systemPrompt: string;
}

/**
 * Build the system prompt for the meta-LLM that generates agent instructions.
 * Sets the persona: a senior staff engineer who writes production-ready
 * agent configs.
 */
function metaSystemPrompt(): string {
  return `You are a Staff Engineer who designs multi-agent AI workflows.
Given a project context and a list of agent roles, you write concise,
specific, executable system prompts for each agent.

Rules for each agent's system prompt:
- 8 to 15 lines of concrete instructions (keep it tight)
- Reference the actual tech stack and tools when known
- Include Responsibilities (1-2 lines)
- Include File scope (globs, 1 line)
- Include Hand-off protocol (1 line: what to return)
- Include Quality bar (1 line: what "done" means)
- No filler ("you are a helpful assistant") — every line must add value
- Plain text, no markdown headers

Output: a JSON object mapping each agent name to its system prompt string.
Never include the agent name inside its own prompt (redundant).
Do NOT wrap your response in markdown fences. Output raw JSON only.`;
}

/**
 * Build the user prompt that asks the LLM to generate system prompts
 * for all agents in a loop, given the project context.
 */
export function buildAgentGenPrompt(
  loopName: string,
  pattern: string,
  agents: AgentSpec[],
  ctx: ProjectContext | null,
): string {
  const ctxBlock = ctx ? formatContextForPrompt(ctx) : 'No project context provided. Generate generic but specific instructions.';
  const agentsBlock = agents
    .map(
      (a, i) =>
        `${i + 1}. label="${a.label}", role="${a.role}", agent="${a.agent}", desc="${a.description}"`,
    )
    .join('\n');

  return `# Task
Generate detailed system prompts for ${agents.length} agents in the "${loopName}" loop (pattern: ${pattern}).

# Project context
${ctxBlock}

# Agents to populate
${agentsBlock}

# Output format
Respond with a JSON object:
{
  "${agents[0]?.agent ?? 'agent1'}": "<15-30 line system prompt>",
  "${agents[1]?.agent ?? 'agent2'}": "<15-30 line system prompt>"
}
Include every agent. Keys are the agent names exactly as given above.`;
}

/**
 * Build a prompt that asks the LLM to recommend an agent roster
 * based on project context + loop name.
 */
export function buildAgentRecommendPrompt(
  loopName: string,
  pattern: string,
  ctx: ProjectContext | null,
  industryHint?: string,
): string {
  const ctxBlock = ctx ? formatContextForPrompt(ctx) : 'No specific context — recommend a general-purpose roster.';
  const hint = industryHint ? `\nIndustry hint: ${industryHint}` : '';

  return `# Task
Recommend 4 to 8 agents for a "${loopName}" loop using the "${pattern}" pattern.

# Project context
${ctxBlock}${hint}

# Output format
Respond with a JSON array. Each element:
{
  "label": "Human-readable name",
  "agent": "kebab-case-id",
  "role": "one of: leader|worker|reviewer|security|tester|doc-writer|router|specialist|merge",
  "description": "One-line responsibility"
}
Recommend agents that fit the project's tech stack and industry. Avoid generic "Frontend/Backend" if the project is e.g. a data pipeline — use "Data Engineer" / "Analyst" instead.`;
}

/**
 * Format ProjectContext into a prompt-friendly text block.
 */
function formatContextForPrompt(ctx: ProjectContext): string {
  const parts: string[] = [];
  parts.push(`Loop name: ${ctx.loopName}`);
  if (ctx.projectName) parts.push(`Project: ${ctx.projectName}`);
  if (ctx.description) parts.push(`Description: ${ctx.description}`);
  if (ctx.languages.length) parts.push(`Languages: ${ctx.languages.join(', ')}`);
  if (ctx.frameworks.length) parts.push(`Frameworks: ${ctx.frameworks.join(', ')}`);
  if (ctx.projectType) parts.push(`Project type: ${ctx.projectType}`);
  if (ctx.tools.length) parts.push(`Tools: ${ctx.tools.join(', ')}`);
  if (ctx.deployTarget) parts.push(`Deploy: ${ctx.deployTarget}`);
  if (ctx.scale) parts.push(`Scale: ${ctx.scale}`);
  if (ctx.keyPaths.length) parts.push(`Key files: ${ctx.keyPaths.join(', ')}`);
  return parts.join('\n');
}

export { metaSystemPrompt };
