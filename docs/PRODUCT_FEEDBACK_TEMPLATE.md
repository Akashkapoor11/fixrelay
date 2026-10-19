# Developer product feedback — FixRelay

*Honest observations from building FixRelay for the Amazon Developer Hackathon 2026.*

## Tool / API / SDK 1: Model Context Protocol TypeScript SDK (`@modelcontextprotocol/server` v2)

- **Used for:** Streamable HTTP server, 8 tool registrations with Zod schemas, tool discovery and tool calls.
- **What worked well:** `McpServer.tool()` with inline Zod schemas is clean. Zod drives both runtime validation and the `inputSchema` JSON Schema that clients receive in `tools/list`, removing a full validation layer. Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) help AI clients reason about safety. `toNodeHandler(mcpHandler)` integrates with Express in one line.
- **What needs work:** (1) `toNodeHandler` must be mounted *before* `express.json()` — a silent failure if violated, not prominently documented. (2) HTTP 202 vs 204 for notification acknowledgements: clients must handle both but neither is shown in the getting-started guide. (3) Multi-line SSE `data:` frame splitting is not mentioned; two independent clients in this project initially parsed only the first line. (4) `protocolVersion` appears in both the response body and `Mcp-Protocol-Version` header — the authoritative source is not specified.
- **Onboarding from zero to hello world:** ~2 hours to a working `tools/list` response. Main friction: v2 is a breaking rename from v1 with no shim.
- **Would you build with it again?** Yes. Developer experience is good once the ordering constraint and notification-acknowledgement behavior are understood.

## Tool / API / SDK 2: Strands Agents TypeScript SDK (`@strands-agents/sdk`)

- **Used for:** Optional Bedrock-backed agent orchestration — `BedrockModel` + `McpClient` as a tool, called via `agent.invoke()`.
- **What worked well:** Passing `McpClient` directly in the `tools` array gives the agent access to all registered MCP tools with no per-tool wrapper. `BedrockModel` mirrors the Python SDK API, reducing ramp-up time.
- **What needs work:** (1) `agent.invoke()` has no built-in timeout — a hung Bedrock call blocks the Node.js worker indefinitely; a `timeoutMs` parameter is necessary for production use. (2) Final assistant text lives in `result.lastMessage` but this field is not in the public TypeScript documentation. (3) `McpClient.disconnect()` lifecycle is unclear: per-request or per-process?
- **Onboarding:** Straightforward once Bedrock model access was confirmed. The `BedrockModel` constructor mirrors the Python SDK API.
- **Would you use it again?** Yes, with the caveat that a timeout must be added manually until the SDK exposes one.

## Tool / API / SDK 3: Amazon Bedrock

- **Used for:** Live model inference for the Strands agent path (`AI_PROVIDER=bedrock`).
- **What worked well:** IAM permission model is clean: `bedrock:InvokeModel` on the specific model ARN is sufficient. The model returned structured, relevant tool-call decisions when given a clear system prompt.
- **What needs work:** (1) Model ID format varies by region — in `us-east-1`, cross-region inference IDs use the `global.` prefix (`global.anthropic.claude-sonnet-4-6`); the prefix is region-specific and not surfaced in SDK error messages. A mismatched ID causes `AccessDeniedException` with no indication the model ID is wrong vs. an IAM issue. (2) Model access must be requested per region with variable lead time.
- **Onboarding:** Model access request → IAM policy → env vars → `npm run aws:preflight` → `npm run aws:verify`. The preflight script makes the process reproducible. Main friction: model ID prefix inconsistency.
- **Would you use it again?** Yes. Once model access and ID format are confirmed, the integration is stable.

## Tool / API / SDK 4: React 19, TypeScript, Vite 7, Tailwind CSS 4

- **Used for:** Full-page React SPA: Dashboard, Investigation, Device Inventory, Repair Cases, MCP Lab. Responsive CSS design system.
- **What worked well:** Vite 7 HMR is instant. `@tailwindcss/vite` (v4) integrates without a PostCSS config file. TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` caught several real type mismatches at design time.
- **What needs work:** Tailwind v4's `@import "tailwindcss"` replaces v3 `@tailwind` directives — existing v3 docs in search results cause setup confusion.
- **Onboarding:** Fast. Tailwind v4 migration took ~30 minutes to resolve directive differences from v3 tutorials.
- **Would you build with them again?** Yes. The combination produces fast, type-safe UIs with minimal configuration.

## Tool / API / SDK 5: PostgreSQL 16 + `pg` (node-postgres)

- **Used for:** Devices table, manuals with GIN full-text index, repair cases, case events, conversation messages, approval tokens, audit logs.
- **What worked well:** GIN full-text indexing with `tsvector`/`tsquery` performed well for manual excerpt search. Row-level locking (`SELECT … FOR UPDATE`) in the approval token transaction reliably prevented double-spend. Idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations made schema evolution safe.
- **What needs work:** `pg` query results are untyped at runtime — the `pool.query<RowType>` generic is TypeScript-only. Runtime validation of DB rows requires a separate Zod parse step.
- **Onboarding:** Straightforward with the Docker Compose service. `npm run db:init` runs the full idempotent schema and seed in one step.
- **Would you use it again?** Yes. PostgreSQL is the most reliable choice for this combination of structured data, full-text search, and transactional guarantees.

## Friction log

**1. MCP notification acknowledgement parsing**
- **Task attempted:** Browser MCP client completing the `notifications/initialized` handshake step.
- **Expected result:** Silent success — notification acknowledged, no body required.
- **Actual result:** `SyntaxError: Unexpected end of JSON input` when calling `response.json()` on the empty 202 body, treated as a transport failure.
- **Severity:** High (broke the MCP Lab end-to-end for all tool calls).
- **Workaround:** Detect notification messages (no `id`, method starts with `notifications/`) before parsing; accept empty 202/204 without reading the body.
- **Actionable suggestion:** Document the expected response shape for notifications in the MCP Streamable HTTP getting-started guide.

**2. Bedrock model ID prefix is region-specific with a generic error**
- **Task attempted:** First live Bedrock inference call in `us-east-1`.
- **Expected result:** Successful inference.
- **Actual result:** `AccessDeniedException` with no indication the model ID format was wrong — `anthropic.claude-sonnet-4-6` should be `global.anthropic.claude-sonnet-4-6` for cross-region inference.
- **Severity:** Medium (resolved in ~20 minutes after finding the prefix in a blog post, not the SDK docs).
- **Actionable suggestion:** Distinguish IAM policy denials from incorrect model IDs in the `AccessDeniedException` message, or add a region-to-model-ID-prefix table to the Bedrock documentation.
