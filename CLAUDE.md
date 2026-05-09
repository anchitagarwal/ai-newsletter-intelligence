# Claude Code — Project Context

## What this is

Daily n8n pipeline: Gmail newsletters → Claude Sonnet 4.6 analysis → Obsidian KB update + Discord digest.
Owner: Anchit Agarwal (anchit008@gmail.com). Laid off from Coinbase May 2026. Active job search for Applied AI / ML Engineer roles.

## Infrastructure

- **n8n**: `http://100.78.122.93:5678` (Hetzner VPS via Tailscale)
- **Obsidian REST API**: `http://100.125.175.107:27123` (Mac via Tailscale, port 27123)
- **VPS Tailscale IP**: `100.78.122.93`
- **Mac Tailscale IP**: `100.125.175.107`
- **Discord**: Server "Latent Space", channel `#ai-intelligence`

## Key n8n design rules (hard-won lessons)

1. **Never use `$node[]` except for direct ancestors** — parallel branches break cross-node refs. Always pass data forward via return objects, read from `$input`.
2. **Call Claude is a Code node** (not HTTP Request node) — must return `{ claude_response, kb_content, projects_content }` together so Parse and Merge can read all three from `$input.first().json`.
3. **Read → merge → PUT pattern** — Obsidian append (`POST`) is unreliable. Always GET full file → merge in code → PUT full file back.
4. **Guard before write** — IF node checks `$json.kb_content.length > 100` before Obsidian writes. Prevents overwriting files with empty content if read fails.
5. **Fan out only at the final stage** — all processing must be linear. Only the last output nodes (Discord, Obsidian writes) fan out.

## Active blocker

Obsidian REST API not reachable from VPS via Tailscale. `ECONNREFUSED 100.125.175.107:27123`.
Fix: `./scripts/fix-obsidian-connectivity.sh` (socat forward on Mac).

## Remaining work

- [ ] Fix Obsidian connectivity (socat or bind address in Local REST API plugin)
- [ ] Implement Call Claude code node in n8n (replace separate HTTP nodes)
- [ ] Update Parse and Merge to read from `$input.first().json` not `$node[]`
- [ ] Add guard IF node after Collect All Context
- [ ] End-to-end test

## Newsletter sources

Gmail filter hits: avichawla, aibyaakash, lenny, pragmaticengineer, dataengineeringweekly, towardsdatascience, chamath, superintelligencenews, businessanalytics, analyticsengineeringroundup, eczachly, bytebytego, aakashgupta (all @substack.com or their domains).

## Anchit's target companies (flag in Claude output)

- **fal.ai** (HIGH) — AI inference infra, KServe/model serving match
- **Discord** (MEDIUM-HIGH) — Staff DE, real-time pipelines
- **TRM Labs** (MEDIUM) — MLOps, blockchain analytics
- **Airbnb** (MEDIUM-LOW) — Only if directly AI/ML at marketplace scale
