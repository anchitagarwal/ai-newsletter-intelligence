# Latent Space — Newsletter Intelligence: Claude Code Handoff

> Everything Claude Code needs to continue this project. Full context, current state, blockers, and remaining work.

---

## What this project is

A daily automated pipeline that:
1. Pulls AI/tech newsletters from Gmail each morning
2. Analyzes them with Claude (Sonnet 4.6)
3. Updates two living Obsidian documents (knowledge base + project recommendations) with deduplicated, scored, company-flagged intelligence
4. Posts a digest to a Discord channel shared with Juhi (wife, PM in adtech)

**Purpose:** Keep Anchit's interview prep and upskilling automatically current during a job search. Domain expertise + AI is the differentiator. Every output must be framed as a business problem solved, not a technology built.

---

## Infrastructure

| Component | Detail |
|-----------|--------|
| VPS | Hetzner CX22, Helsinki, $4.50/month |
| VPS IP (public) | Ask Anchit |
| VPS Tailscale IP | `100.78.122.93` |
| Mac Tailscale IP | `100.125.175.107` |
| n8n URL | `http://100.78.122.93:5678` |
| n8n auth | user: `anchit`, password: ask Anchit |
| Docker container | `n8n` — running with `N8N_SECURE_COOKIE=false` |
| Tailscale | Installed on both VPS and Mac. Both devices authenticated to `anchit008@` account |

### n8n Docker command (current working version)
```bash
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=anchit \
  -e N8N_BASIC_AUTH_PASSWORD=changeme123 \
  -e WEBHOOK_URL=http://100.78.122.93:5678 \
  -e GENERIC_TIMEZONE=America/Los_Angeles \
  -e N8N_SECURE_COOKIE=false \
  -v /opt/n8n:/home/node/.n8n \
  n8nio/n8n
```

Note: `chown -R 1000:1000 /opt/n8n` must be run before starting or it crashes with EACCES.

---

## n8n Credentials (already set up)

| Credential name | Type | Notes |
|----------------|------|-------|
| `Gmail OAuth2` | Gmail OAuth2 | Working. Google Cloud project: "AI Newsletter Automation" |
| `Anthropic API` | Anthropic (predefined) | Working. Use model `claude-sonnet-4-6` |
| `Obsidian REST API` | Header Auth | Name: `Authorization`, Value: `Bearer <key>`. **CONNECTION CURRENTLY BROKEN — see blocker below** |

---

## Newsletter sources (Gmail filter)

```
from:(avichawla@substack.com OR aibyaakash@substack.com OR lenny@substack.com OR
pragmaticengineer@substack.com OR dataengineeringweekly@substack.com OR
newsletter@towardsdatascience.com OR chamath@substack.com OR
superintelligencenews@substack.com OR businessanalytics@substack.com OR
analyticsengineeringroundup@substack.com OR eczachly@substack.com OR
bytebytego@substack.com OR aakashgupta@substack.com) newer_than:1d
```

Gmail node returns emails with `item.json.text` (plain text, already decoded — no base64 needed). Use `msg.text || msg.textAsHtml || msg.snippet`.

---

## Obsidian setup

- Plugin: Local REST API (community plugin), port 27123, running on Anchit's Mac
- Vault files being written:
  - `Work/Job Search/Prep/AI ML Knowledge Base.md`
  - `Work/Job Search/Prep/AI Project Recommendations.md`
- API base URL: `http://100.125.175.107:27123`
- Auth header: `Authorization: Bearer <key>`
- Read: `GET /vault/{filepath}`
- Write (full overwrite): `PUT /vault/{filepath}` with `Content-Type: text/markdown`

### CRITICAL BLOCKER: Obsidian connectivity

The VPS cannot reach the Obsidian REST API at `100.125.175.107:27123`. Error: `ECONNREFUSED`.

**Diagnosis so far:**
- Tailscale is connected on both devices (confirmed via `tailscale status`)
- The Local REST API plugin may be binding to `127.0.0.1` only, not the Tailscale interface
- `lsof -i :27123` on Mac not yet confirmed

**Likely fix:** Run socat on Mac to forward Tailscale interface to localhost:
```bash
socat TCP-LISTEN:27124,bind=0.0.0.0,fork TCP:127.0.0.1:27123
```
Then update all Obsidian node URLs in n8n to use port `27124`.

**Alternative:** Check Obsidian Local REST API settings for a "Listen on all interfaces" or "Bind address" option and set it to `0.0.0.0`.

---

## Workflow design (current target: v3)

### Node chain (linear — no parallel branches)

```
Daily Trigger 7am
  → Fetch Newsletters (Gmail)
  → Any newsletters today? (IF)
  → Combine Newsletter Content (Code)
  → Read KB File (HTTP GET → Obsidian)
  → Attach Newsletter to KB (Code — passes newsletter text + kb_content forward)
  → Read Projects File (HTTP GET → Obsidian)
  → Collect All Context (Code — merges all three into one object)
  → Call Claude (Code — makes HTTP call, returns claude_response + kb_content + projects_content)
  → Parse and Merge Output (Code — merges existing files with new content, builds updated docs)
  → [fan out to 4 nodes]:
      Write KB to Obsidian (HTTP PUT)
      Write Projects to Obsidian (HTTP PUT)
      Post Summary to Discord
      New KB items? (IF) → Post KB to Discord → New project ideas? (IF) → Post Projects to Discord
```

### Key design decisions

**Why linear chain instead of parallel branches:** n8n code nodes cannot reliably reference nodes that aren't direct ancestors via `$node[]`. Parallel branches cause `$node['X'].json` to return empty in downstream code nodes. Everything must flow linearly and be passed forward explicitly via `$input`.

**Why Call Claude is a Code node (not HTTP Request node):** The HTTP Request node cannot pass `kb_content` and `projects_content` forward alongside the Claude response. A Code node that makes the fetch call itself returns all three fields together, making them available to Parse and Merge via `$input.first().json`.

**Read → merge → PUT pattern:** The Obsidian append API (`POST`) was unreliable. Instead: read full file → merge new content in code → PUT full updated file back. This gives full control over the document structure.

---

## The Call Claude code node (critical — replaces Build System Prompt + Analyze with Claude)

```javascript
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
    'x-api-key': 'YOUR_ANTHROPIC_API_KEY'
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
```

---

## The Parse and Merge Output code node

```javascript
const claudeText = $input.first().json.claude_response || '';
const existingKB = $input.first().json.kb_content || '';
const existingProjects = $input.first().json.projects_content || '';

const extract = (content, marker, endMarker) => {
  const start = content.indexOf(marker);
  if (start === -1) return '';
  const end = endMarker ? content.indexOf(endMarker, start) : content.length;
  return content.slice(start + marker.length, end === -1 ? content.length : end).trim();
};

const today = new Date().toISOString().split('T')[0];
const kb = extract(claudeText, '===KNOWLEDGE_BASE===', '===PROJECTS===');
const projects = extract(claudeText, '===PROJECTS===', '===SUMMARY===');
const summary = extract(claudeText, '===SUMMARY===', null);

// Apply EXISTING_UPDATEs inline to existing content
const applyUpdates = (existing, newContent) => {
  let updated = existing;
  const lines = newContent.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('EXISTING_UPDATE:')) {
      const conceptName = lines[i].replace('EXISTING_UPDATE:', '').trim();
      const angleLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('EXISTING_UPDATE:') && !lines[i].startsWith('SCORE:')) {
        angleLines.push(lines[i]);
        i++;
      }
      const newAngle = angleLines.join('\n').trim();
      if (newAngle && updated.includes(`**${conceptName}**`)) {
        updated = updated.replace(`**${conceptName}**`, `**${conceptName}**\n> **New angle (${today}):** ${newAngle}`);
      }
    } else {
      i++;
    }
  }
  return updated;
};

// Strip EXISTING_UPDATEs, keep only new scored items
const stripUpdates = (content) => {
  const lines = content.split('\n');
  const result = [];
  let skip = false;
  for (const line of lines) {
    if (line.startsWith('EXISTING_UPDATE:')) { skip = true; continue; }
    if (skip && line.startsWith('SCORE:')) skip = false;
    if (!skip) result.push(line);
  }
  return result.join('\n').trim();
};

const newKBItems = stripUpdates(kb);
const newProjectItems = stripUpdates(projects);

let updatedKB = applyUpdates(existingKB, kb);
if (newKBItems.length > 50) {
  updatedKB = updatedKB + `\n\n---\n\n## Added ${today}\n\n` + newKBItems;
}

let updatedProjects = applyUpdates(existingProjects, projects);
if (newProjectItems.length > 50) {
  updatedProjects = updatedProjects + `\n\n---\n\n## Added ${today}\n\n` + newProjectItems;
}

const summaryMsg = `## Latent Space — Daily Intelligence ${today}\n\n**Today's Signals**\n${summary}`;
const kbMsg = newKBItems.length > 50 ? `**New Concepts Added**\n${newKBItems.substring(0, 1800)}` : null;
const projectsMsg = newProjectItems.length > 50 ? `**New Project Ideas Added**\n${newProjectItems.substring(0, 1800)}` : null;

return [{ json: {
  date: today,
  updated_kb: updatedKB,
  updated_projects: updatedProjects,
  summary_msg: summaryMsg,
  kb_msg: kbMsg,
  projects_msg: projectsMsg,
  has_new_kb: newKBItems.length > 50,
  has_new_projects: newProjectItems.length > 50
} }];
```

---

## Combine Newsletter Content code node

```javascript
const items = $input.all();

const newsletters = items.map(item => {
  const msg = item.json;
  const subject = msg.subject || msg.Subject || 'No subject';
  const sender = msg.from?.text || msg.From || 'Unknown';
  const body = msg.text || msg.textAsHtml || msg.snippet || '';
  const cleaned = body
    .replace(/https?:\/\/[^\s\]]+/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/͏/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
  return `--- NEWSLETTER ---\nFrom: ${sender}\nSubject: ${subject}\n\n${cleaned.substring(0, 4000)}`;
});

return [{ json: { combined_text: newsletters.join('\n\n'), count: items.length } }];
```

---

## Attach Newsletter to KB code node

```javascript
const kbContent = $input.first().json.content || '';
const newsletterText = $node['Combine Newsletter Content'].json.combined_text || '';
return [{ json: { kb_content: kbContent, combined_text: newsletterText } }];
```

Note: This is the one place `$node[]` is used and it works because `Combine Newsletter Content` is a direct ancestor just two hops back with no branching.

---

## Collect All Context code node

```javascript
const projectsContent = $input.first().json.content || '';
const kbContent = $input.first().json.kb_content || '';
const combinedText = $input.first().json.combined_text || '';

return [{ json: {
  combined_text: combinedText,
  kb_content: kbContent,
  projects_content: projectsContent
} }];
```

---

## Discord output

Server: **Latent Space**
Channel: `#ai-intelligence`
Members: Anchit + Juhi

Three message types posted per run:
1. Daily summary (always posted)
2. New KB concepts (only if score >= 7 items found)
3. New project ideas (only if score >= 7 items found)

Discord 2000 char limit per message — content truncated to 1800 chars per message.

---

## Todos

### Done
- [x] Hetzner VPS provisioned and running
- [x] Docker installed on VPS
- [x] Tailscale connected on VPS and Mac
- [x] n8n running at `http://100.78.122.93:5678`
- [x] Gmail OAuth credential set up and working
- [x] Anthropic API credential set up and working
- [x] Gmail node correctly fetches and decodes newsletter body text
- [x] Combine Newsletter Content node working (cleans HTML, strips URLs, truncates)
- [x] Claude analysis working end-to-end (correct model string: `claude-sonnet-4-6`)
- [x] Discord output working (summary + KB + projects posted to channel)
- [x] System prompt designed with full Anchit context, company pipeline, business-first mindset
- [x] Deduplication and scoring logic designed (EXISTING_UPDATE pattern, score >= 7 threshold)
- [x] Parse and Merge logic designed (read existing → merge → PUT full file back)
- [x] Obsidian credential configured in n8n
- [x] Obsidian files restored after accidental overwrite

### Remaining — Critical (blocker)
- [ ] **Fix Obsidian connectivity from VPS** — port 27123 on Mac not reachable via Tailscale (`ECONNREFUSED 100.125.175.107:27123`). Options: (a) socat forward on Mac to bind Tailscale interface, (b) check Local REST API plugin for bind address setting. Must be fixed before Read/Write nodes can work.

### Remaining — Core workflow
- [ ] **Implement Call Claude code node** — replace the separate Build System Prompt + Analyze with Claude HTTP nodes with a single Code node that makes the fetch call and returns `{ claude_response, kb_content, projects_content }` together. This solves the cross-node reference problem that causes `kb_content` to be empty in Parse and Merge.
- [ ] **Update Parse and Merge Output** — change first three lines to read from `$input.first().json` directly (not `$node[]` references)
- [ ] **Add guard node** — after Collect All Context, add IF node checking `$json.kb_content.length > 100` before proceeding. If Obsidian read fails and returns empty, stop the workflow instead of overwriting files with empty content.
- [ ] **End-to-end test** — run full workflow manually, verify Obsidian files are correctly updated (existing content preserved + new content appended with date header), verify Discord messages arrive

### Remaining — Nice to have
- [ ] Error notification — post to Discord if workflow fails (n8n has built-in error workflow support)
- [ ] Dedup test — run twice with same newsletters, verify second run produces no new additions
- [ ] Update Obsidian setup doc with final working workflow JSON
- [ ] Consider adding company-specific Obsidian files as additional read context (fal.ai.md, Discord.md, TRM Labs.md are in vault at `Work/Job Search/Companies/`)

---

## Key lessons learned (do not repeat)

1. **n8n `$node[]` cross-references are unreliable** — only works for direct ancestors, not nodes further back in the chain or in parallel branches. Always pass data forward explicitly via return objects and read from `$input`.

2. **Never use PUT/POST to Obsidian without a guard** — if the Read node fails silently and returns empty, the write will overwrite the file with nothing. Always check `kb_content.length > 100` before proceeding to write.

3. **n8n parallel fan-out does not share data** — the `Any newsletters today?` IF node can only fan out to one branch at a time. All processing must be linear; fan out only at the final output stage after all data is computed.

4. **Obsidian POST append is unreliable** — use GET to read + PUT to overwrite the full merged document. Do not rely on the append endpoint.

5. **Gmail node returns decoded text directly** — use `msg.text`, not `msg.payload.body.data`. The n8n Gmail node handles base64 decoding automatically.
