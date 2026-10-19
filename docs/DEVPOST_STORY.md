# Devpost project story — FixRelay

## Built during the hackathon window

FixRelay was created entirely within the Amazon Developer Hackathon submission period (August 31 – October 23, 2026). All source code, the MCP server, the Strands + Bedrock agent integration, the PostgreSQL schema, the approval-token security model, the React frontend, and the MCP Sentinel open-source CLI were written during the submission window specifically for this hackathon.

## Inspiration

Every time a household device breaks, the same frustrating loop begins: pull out the receipt to check the purchase date, search for the manual PDF, wonder if it is even still under warranty, watch an AI chatbot confidently recommend a fix it cannot verify, then realise you still do not know whether calling a technician is covered. The information exists — purchase date, serial number, safety instructions — but it lives in separate places with no clear, grounded path from "something is wrong" to "here is what to do next and why."

The Model Context Protocol opened a cleaner path: expose those domain operations as real callable tools, let an agent compose them, and keep the user in control of what gets written. FixRelay was built to show that an agentic workflow can be both capable and honest — showing *why* it reached a conclusion, not just what the conclusion is.

## What it does

FixRelay gives households a single, evidence-grounded workflow for device problems:

1. **Device match** — describe the device or model name; the app matches it against a structured inventory stored in PostgreSQL.
2. **Evidence retrieval** — a full-text GIN-indexed search returns source-labelled excerpts from manuals and safety guides. Every excerpt is explicitly marked as synthetic demo data or user-submitted (and therefore unverified); the app never implies a source is authentic unless a separate trusted process has set the database verified flag.
3. **Warranty date window** — the app computes an expiry date from the recorded purchase date and warranty duration. The result is labelled as date arithmetic, not a manufacturer coverage decision.
4. **Safety-first triage** — a deterministic classifier detects emergency language (sparks, smoke, gas, electric shock) and surfaces conservative safety guidance before any troubleshooting steps.
5. **Service options** — illustrative next steps (self-check, support contact, qualified service) with an explicit label that no provider has been contacted and no booking has been made.
6. **Human-approved case draft** — the user sees the exact draft summary in a styled confirmation modal, approves it explicitly, and only then is a single-use approval token issued and consumed inside a database transaction.
7. **MCP Lab** — a built-in developer panel performing a full Streamable HTTP handshake against the live `/mcp` endpoint, showing the raw JSON-RPC response.
8. **MCP Sentinel** — a standalone open-source CLI smoke-tester for any MCP Streamable HTTP server, with JSON and JUnit output for CI pipelines.

## How we built it

**Frontend:** React 19 + TypeScript + Tailwind CSS 4 compiled by Vite 7. The MCP Lab uses a browser-side JSON-RPC client in `api.ts` that correctly handles SSE responses, multi-line `data:` frames, and empty HTTP 202 notification acknowledgements.

**Backend:** Node.js 22 + Express 5 + TypeScript with Helmet, a hostname allowlist (DNS-rebinding prevention), CORS origin allowlist, rate limiter, and Zod 4 input validation on every route.

**Database:** PostgreSQL 16 with a GIN full-text index on manuals, idempotent migrations, and a row-level-locked approval token table. Tokens are stored only as SHA-256 hashes and expire in 180 seconds.

**MCP:** The official MCP TypeScript SDK v2 registers 8 tools with Zod input schemas and tool annotations. The handler is mounted *before* the Express JSON body parser — the critical ordering requirement for Streamable HTTP.

**Optional AWS path:** The Strands Agents TypeScript SDK with `BedrockModel` and `StreamableHTTPClientTransport`. A `verify-aws.ts` script performs a structured preflight and, only after an explicit `YES` confirmation, makes one Bedrock inference call and queries the audit log to confirm the agent called a real MCP tool. A 45-second timeout wraps `agent.invoke()` so a hung Bedrock call never blocks indefinitely.

## Challenges we faced

**MCP protocol version negotiation:** The first client checked the response header strictly. When the SDK returned the version only in the body, the handshake silently succeeded but tool calls failed. Switching from strict equality to `startsWith('2025-11-25')` and adding header/body fallback logic in all three clients (browser, Sentinel CLI, AWS verifier) resolved the inconsistency.

**Empty notification acknowledgement:** The browser client initially tried to parse the HTTP 202 empty body for `notifications/initialized` as JSON, throwing a silent parse error. The fix: detect notification messages (no `id` field, `method` starts with `notifications/`) before attempting to parse. The same bug existed in both the browser client and MCP Sentinel; both were fixed with a shared `isAcceptedNoContentNotification` helper.

**Approval token binding:** The initial token bound only device ID and issue text. A modified summary (shorter, different evidence count) still consumed the original token. The hash was extended to cover `deviceId + normalised(issue) + normalised(summary) + sessionId`, so any change to the confirmed draft invalidates the token.

**Stop-word evidence leak:** A query containing only stop words (`what about it`) fell through the filter and returned the most recent manual excerpts, potentially showing unrelated evidence. The fix returns an empty array and a regression test in `service.integration.test.ts` verifies the corrected behaviour.

## What we learned

- **MCP Streamable HTTP is more nuanced than it looks.** SSE framing, multi-line `data:` continuation, notification-vs-request response handling, and header vs body version negotiation are all silent failure points. Writing MCP Sentinel as a second, independent client exposed several issues that only appear when client and server disagree on assumptions.
- **Evidence provenance requires deliberate design.** Every source must be labelled as synthetic or unverified explicitly — it is not a default. This required database columns, UI states, and test assertions working together.
- **Approval boundaries are not just UX.** The token mechanism started as a user-confirmation affordance. Extending it to cover the full normalised draft hash turned it into a meaningful security control against replay and summary substitution attacks through the MCP mutation path.
- **Timeout discipline matters for AI agents.** Without `Promise.race` and an explicit 45-second limit, one slow Bedrock response blocks a Node.js worker indefinitely.

## What's next

Real licensed product-document ingestion, user identity and per-household tenancy, genuine support-channel integrations, accessibility audit, production observability, and expanding MCP Sentinel to cover authentication and transport-level conformance beyond current smoke-test scope.
