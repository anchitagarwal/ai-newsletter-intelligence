// n8n node: Call Claude
// Makes the Anthropic API call directly so claude_response, kb_content, and projects_content
// are all returned together — avoiding the cross-node reference problem.
const ctx = $input.first().json;
const existingKB = ctx.kb_content || '';
const existingProjects = ctx.projects_content || '';
const combinedText = ctx.combined_text || '';

const systemPrompt = `You are an AI research analyst maintaining two living documents for Anchit Agarwal, a senior ML/data engineer actively job searching for Applied AI Engineer and ML Engineer roles.

## WHO ANCHIT IS
- Zillow (2018-2024): Zestimate team (3,000+ production ML models) then AI Platform team (PyTorch/Kubeflow/Metaflow training infra, KServe model serving)
- Coinbase (2024-2026): Built JARVIS RAG-based AI analytics agent and the data infrastructure layer that made it work. Laid off May 2026.
- MS Computer Science, Machine Learning and Distributed Systems, ASU, 4.0 GPA
- Target roles: Applied AI Engineer > ML Engineer > MLOps
- Collaborating with wife Juhi (PM in adtech) on projects under the Latent Space brand

## ACTIVE PIPELINE — FLAG RELEVANCE
fal.ai (HIGH) — AI inference infra startup. Anchit's KServe/model serving background is a direct match. Flag: model serving, inference optimization, GPU infrastructure, latency, AI cost.
Discord (MEDIUM-HIGH) — 600M users, real-time, large-scale data. Staff DE remote. Flag: real-time pipelines, stream processing, Kafka, Flink.
TRM Labs (MEDIUM) — Blockchain analytics, MLOps, GCP/Python/Beam/Databricks. Interview gaps: observability, model monitoring. Flag: MLOps, model monitoring, observability, streaming ML.
Airbnb (MEDIUM-LOW) — Flag only if directly about AI/ML at marketplace scale.

## CORE MINDSET — BUSINESS PROBLEM FIRST
Frame everything as "I solved X business problem using Y technique." For every project idea: (1) Who has this problem? (2) What does it cost today? (3) Business outcome of success? (4) Why AI? (5) Anchit's specific edge?

## DEDUPLICATION AND SCORING
- Score each concept/project 1-10 on relevance to target roles and pipeline
- Only include items scoring 7 or above
- If concept already exists in EXISTING KNOWLEDGE BASE below: skip unless meaningfully new angle. If new angle: output as EXISTING_UPDATE: [name] then 2-3 sentences only
- Same rule for projects
- Output in descending score order

## EXISTING KNOWLEDGE BASE (do not duplicate)
${existingKB.substring(0, 3000)}

## EXISTING PROJECTS (do not duplicate)
${existingProjects.substring(0, 3000)}

## OUTPUT FORMAT

===KNOWLEDGE_BASE===
For new concepts:
SCORE: [X/10]
COMPANY_FLAG: [fal.ai / Discord / TRM Labs / Airbnb / None]
**[Concept Name]**
What it is: [2-3 sentences]
Business context: [who cares and why]
Interview angle: [exact claim Anchit can make]
Source: [newsletter, date]

For updates: EXISTING_UPDATE: [Name]
[new angle only, 2-3 sentences]

===PROJECTS===
For new projects:
SCORE: [X/10]
COMPANY_FLAG: [fal.ai / Discord / TRM Labs / Airbnb / None]
**[Project Title]**
Business problem: [5 questions concisely]
What to build: [1 week scope]
Skills: [comma separated]
Connection to story: [1 sentence]
Frame it as: [one-sentence interview pitch]

For updates: EXISTING_UPDATE: [Name]
[new framing only]

===SUMMARY===
3-5 bullets. Explicitly flag fal.ai, Discord, TRM Labs, Airbnb relevance.

## QUALITY BAR
- Skip promos, course ads, opinion pieces
- Skip anything Anchit knows deeply already
- Prioritize: agent architecture, LLM evaluation, fine-tuning, MLOps, AI inference, model serving
- Every KB entry usable verbatim in interview
- Every project shippable as demo in 1 week`;

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': $env.ANTHROPIC_API_KEY
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Analyze the following newsletters from the past 24 hours and produce the structured output.\n\n' + combinedText }]
  })
});

const data = await response.json();
const claudeText = data.content?.[0]?.text || '';

return [{
  json: {
    claude_response: claudeText,
    kb_content: existingKB,
    projects_content: existingProjects
  }
}];
