# Latent Space — Newsletter Intelligence

Daily automated pipeline: AI/tech newsletters → Claude analysis → Obsidian knowledge base + Discord digest.

**Purpose:** Keep interview prep and upskilling automatically current during job search. Every output is framed as a business problem solved, not a technology built.

## Architecture

```
Daily Trigger 7am (PST)
  → Fetch Newsletters (Gmail)
  → Any newsletters today? (IF)
  → Combine Newsletter Content (Code)
  → Read KB File (HTTP GET → Obsidian)
  → Attach Newsletter to KB (Code)
  → Read Projects File (HTTP GET → Obsidian)
  → Collect All Context (Code)
  → Call Claude (Code — fetch to Anthropic API)
  → Parse and Merge Output (Code)
  → [fan out]:
      Write KB to Obsidian (HTTP PUT)
      Write Projects to Obsidian (HTTP PUT)
      Post Summary to Discord
      New KB items? (IF) → Post KB to Discord
      New projects? (IF) → Post Projects to Discord
```

## Infrastructure

| Component | Detail |
|-----------|--------|
| VPS | Hetzner CX22, Helsinki |
| n8n URL | `http://100.78.122.93:5678` (via Tailscale) |
| Obsidian REST API | `http://100.125.175.107:27123` (Mac, via Tailscale) |
| Discord | Server: Latent Space, Channel: `#ai-intelligence` |

## Code Nodes

The JS for each code node lives in `nodes/` for version control. Copy-paste into n8n.

| File | n8n Node |
|------|----------|
| `nodes/combine_newsletters.js` | Combine Newsletter Content |
| `nodes/attach_newsletter_to_kb.js` | Attach Newsletter to KB |
| `nodes/collect_all_context.js` | Collect All Context |
| `nodes/call_claude.js` | Call Claude |
| `nodes/parse_and_merge_output.js` | Parse and Merge Output |

## Obsidian Files

- `Work/Job Search/Prep/AI ML Knowledge Base.md`
- `Work/Job Search/Prep/AI Project Recommendations.md`

## Current Blocker

Obsidian REST API on Mac not reachable from VPS via Tailscale (`ECONNREFUSED 100.125.175.107:27123`). Run the fix:

```bash
./scripts/fix-obsidian-connectivity.sh
```

See `scripts/fix-obsidian-connectivity.sh` for details.

## n8n Credentials

All credentials live inside n8n — not in this repo.

- `Gmail OAuth2` — Google Cloud project: "AI Newsletter Automation"
- `Anthropic API` — model: `claude-sonnet-4-6`
- `Obsidian REST API` — Header Auth: `Authorization: Bearer <key>`
