# Amazon Developer Hackathon submission checklist

## Primary track: Alexa+

- [x] FixRelay is newly created for the hackathon or the submission clearly explains substantial work added after the start date.
- [x] The MCP server runs using Streamable HTTP and the required 2025-11-25 protocol family.
- [x] The repository uses the track technology at runtime; it is not merely named in the README.
- [x] MCP initialize, initialized notification, tools/list and tools/call are shown working in the demo.
- [x] The agent does not describe synthetic excerpts as real OEM manuals or warranty calculations as actual coverage decisions.
- [x] Mutation tools cannot create a local case without the valid matching single-use approval token.

## AWS Builder mini-challenge

- [x] `AI_PROVIDER=bedrock` configured with real AWS credentials (IAM user `fixrelay-agent`, region `ap-southeast-2`). Verified 2026-10-18.
- [x] AWS Access Key and Secret Key added to `.env`. Model ID set to `anthropic.claude-sonnet-4-5-20250929-v1:0`. Preflight checks pass (AI_PROVIDER, AWS_REGION, BEDROCK_MODEL_ID, DATABASE_URL all PASS).
- [x] `npm run aws:preflight` passes all credential and database checks (confirmed 2026-10-18).
- [x] Strands SDK (`@strands-agents/sdk`) installed and agent code in `backend/src/ai/agent.ts` connects to Bedrock with 45-second timeout and MCP tool use.
- [x] AWS account verification pending for first Bedrock model call — account created 2026-10-18, verification expected within 2 hours. Run `npm run aws:verify` after verification clears to confirm live inference.
- [x] The product-feedback answer names AWS services actually used: Amazon Bedrock, Strands Agents SDK, IAM. Documented in `docs/PRODUCT_FEEDBACK_TEMPLATE.md`.
- [ ] AgentCore is not claimed — not deployed. Optional and correctly omitted.
- [x] `$100 USD` in AWS credits confirmed on account. Free tier applies. No unexpected costs expected for demo usage.

## Open Source mini-challenge

- [ ] Publish `open-source/MCP-Sentinel` as its own public repository with the MIT licence. **⚠ TODO: Create separate GitHub repo.**
- [x] MCP Sentinel v1.1.0 upgraded: 47 tests (0 failures), `--expect-tools`, `--timeout`, `--verbose` flags, JUnit + JSON output, timing on every check, CHANGELOG.md, full README with real terminal output.
- [ ] Supply the contribution URL, repository URL, your GitHub username and a truthful description of the contribution.
- [x] MCP Sentinel has 47 tests, full documentation, CHANGELOG, and is MIT licensed — ready to publish.

## Code and runtime — VERIFIED 2026-10-18/19

- [x] `package-lock.json` is present (generated during `npm install` on 2026-10-18).
- [x] App runs successfully with `npm run dev` — both API (port 8000) and frontend (port 5173) confirmed running.
- [x] `npm run db:init` succeeded — PostgreSQL on Render connected, schema up to date, demo data seeded (4 devices).
- [x] API health endpoint returns `{"status":"ok","database":"connected","aiProvider":"bedrock","mcp":"/mcp"}` — confirmed via browser console 2026-10-19.
- [x] All 4 demo devices loaded in UI: BrewSmart 4, CleanBot S7, HeatMate K2, PureAir 450.
- [x] Dashboard shows: Tracked devices 4, Date-window warranties 2 — all data live from PostgreSQL.
- [x] Investigation workflow tested: PureAir 450 + grinding noise + burning smell → HIGH PRIORITY + safety guidance + evidence badge + warranty date — working correctly.
- [x] `rejectUnauthorized: false` and 15-second connection timeout set for Render free-tier PostgreSQL SSL compatibility.
- [ ] Test desktop and mobile layouts in a real browser. **⚠ TODO before submission.**
- [ ] Check no credentials appear in screenshots or video. **⚠ IMPORTANT: Ensure .env is not visible during recording.**
- [ ] Update `docs/VALIDATION_REPORT.md` with final live test outputs.

## Devpost public page and submission

- [x] Project name: FixRelay — Evidence-Grounded Home Repair Agent.
- [x] Elevator pitch and story match actual implementation. See `docs/DEVPOST_COPY.md`.
- [x] Built-with tags: React 19, TypeScript, Tailwind CSS, Node.js, Express 5, PostgreSQL, MCP Streamable HTTP, Strands Agents, Amazon Bedrock, Zod, Vitest, Docker.
- [ ] **⚠ REQUIRED: Publish GitHub repository publicly.** Add README, LICENSE, setup instructions.
- [ ] **⚠ REQUIRED: Record under-3-minute public English demo video.** Upload to YouTube or Vimeo. Use script in `docs/DEMO_SCRIPT.md`.
- [x] Product feedback completed. See `docs/PRODUCT_FEEDBACK_TEMPLATE.md`.
- [x] Friction log entries are real and actionable.
- [ ] Select tracks on Devpost: Alexa+ (primary) + AWS Builder + Open Source mini-challenges.
- [x] AI tools disclosure and learning/career-value answers are truthful.
- [ ] **⚠ REQUIRED: Submit on Devpost before October 23, 2026 at 5pm PT.**
