# FixRelay architecture

## Product boundary

FixRelay is a transparent workflow prototype, not a manufacturer warranty decision engine or a repair-booking marketplace. Synthetic seed records are labelled. User-supplied excerpts are labelled unverified. The application does not place calls, send messages, book appointments or buy parts. User-added source URLs are stored as provenance only and are never fetched or marked verified automatically.

## Runtime topology

```text
React 19 + TypeScript + Tailwind CSS (Vite)
    │ same-origin API requests / Vite dev proxies
    ├── REST (/api/*) ── Express 5 + TypeScript
    │                         ├── Zod request validation
    │                         ├── FixRelay domain service
    │                         ├── Strands TS Agent (optional)
    │                         │      └── MCP client → /mcp
    │                         └── PostgreSQL (pg)
    └── browser MCP Lab ── JSON-RPC Streamable HTTP (/mcp)
                              └── official MCP TypeScript SDK v2
                                  compatible with 2025-11-25 handshake

Optional AWS:
  Strands Agents TypeScript SDK → Amazon Bedrock
  AgentCore Runtime is an optional separately deployed hosting target.
```

## Frontend

`frontend/src/App.tsx` contains the workspace screens and interactions; `frontend/src/lib/api.ts` defines typed calls to the backend and a browser JSON-RPC client for the MCP Lab. Vite compiles React and Tailwind to `dist/client`. In development Vite proxies `/api` and `/mcp` to the API process. In production Express serves the built client if `dist/client` exists.

## REST API

`backend/src/index.ts` registers security middleware, `/mcp`, typed workflow routes, error mapping and production static serving. The app binds to loopback by default. `helmet`, a configurable CORS allow-list, a rate limiter, JSON body limits and Zod schema validation are used. CORS and Origin checks are defense-in-depth only; this demo does not implement identity, tenancy or production authorization.

## Domain service

`backend/src/domain/service.ts` is shared by REST and MCP so the two interfaces use the same business rules. It owns:

- Device inventory lookup and validated addition.
- Labelled manual/evidence retrieval, including unverified user-supplied excerpts and optional source URLs kept as provenance.
- Warranty date arithmetic that explicitly disclaims manufacturer coverage decisions.
- Safety-oriented triage and next-step recommendations.
- Illustrative service options only.
- One-time approval token issue/validation and local case-draft creation.
- Case status, timeline and audit entries.

`backend/src/domain/logic.ts` contains deterministic normalization, date math, search tokenization and safety classification, separated for unit tests.

## Persistence

PostgreSQL is required. `backend/src/db/schema.sql` creates devices, manuals, repair cases, case events, conversation messages, approval tokens and audit logs. `backend/src/db/pool.ts` owns the connection pool, initialization, seed data and transaction helper. Seed records are inserted only when there are no device rows; use a clean local database for the default scripted demo.

Approval tokens are generated with cryptographic randomness. Only a SHA-256 token hash is stored. The record binds token use to a device ID, normalized issue hash, session ID and expiry. Case creation locks the token row, verifies all bindings, conditionally consumes it and writes the case/event in one transaction. Token values are never placed in audit payloads. This is an accidental-action/replay guard—not authentication.

## MCP server

`backend/src/mcp/server.ts` builds the MCP tool registry with the official TypeScript server SDK and serves it through Streamable HTTP at `/mcp`. The endpoint exposes read-only tools for device lookup, evidence lookup, warranty date calculation, illustrative service options and case status, plus `add_case_note` for a user-requested local note and `create_repair_case` for an approved local draft. Case creation requires a matching one-time approval token; the MCP endpoint cannot mint that token. Note content is redacted from audit arguments. All tool handlers share `FixRelayService` and return JSON content blocks. The server's HTTP handler supports the initialize-based 2025 protocol family required by the hackathon.

The browser lab speaks MCP JSON-RPC: initialize → initialized notification → tools/list → tools/call. `open-source/MCP-Sentinel` independently probes the endpoint and validates the envelope and tool names.

## AI and AWS

`backend/src/ai/agent.ts` uses `@strands-agents/sdk` with `BedrockModel` and a `StreamableHTTPClientTransport` from `@modelcontextprotocol/client`, pointed at `MCP_PUBLIC_URL`. It invokes model reasoning through Amazon Bedrock and exposes FixRelay MCP tools as the agent's tool source. System instructions require evidence, clear source caveats, safety prioritization and no unapproved mutations. Demo mode is deterministic and does not silently pretend to be a live model call.

AgentCore Runtime is optional. `backend/aws/agentcore/README.md` follows the official AWS CLI setup for a TypeScript/Strands project. AgentCore is not considered deployed until an AWS user runs the deploy/invoke steps successfully.

## Data flow for the primary demo

1. User describes a device and issue.
2. API validates the request and matches a device from PostgreSQL.
3. Service retrieves ranked, source-labelled excerpts and computes warranty date arithmetic.
4. A deterministic severity classifier returns conservative safety guidance.
5. UI displays the source caveat, suggested next steps and illustrative service options.
6. User confirms creation of a local case draft.
7. The server creates a matching one-time approval token, consumes it once inside the case transaction, and appends an event.
8. Case history is displayed with an explicit statement that no external service was contacted.

## Important limitations

The project is a hackathon-quality prototype. It does not provide login/identity management, per-user data isolation, anti-CSRF tokens for a public deployment, real OEM document feeds, live support/service-provider discovery, email/SMS, live bookings, purchasing, production observability or backup automation. Add and test those controls before a real customer deployment. Do not expose it directly to the internet with real household data.

## Technical references

- [MCP TypeScript SDK protocol-version support](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
- [MCP TypeScript SDK Streamable HTTP serving](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
- [Strands Agents TypeScript SDK](https://github.com/strands-agents/harness-sdk/tree/main/strands-ts)
- [Amazon Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
- [AgentCore CLI TypeScript quickstart](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli-typescript.html)

## Security boundaries

- `ALLOWED_HOSTS` is an exact hostname allow-list checked before routing. Configure the deployment hostname explicitly; do not use wildcards.
- Browser origins are checked separately by `ALLOWED_ORIGINS`. Host validation is not a replacement for authentication when the app is exposed beyond local/demo use.
- Evidence is unverified by default. Source labels do not imply verification; a separate trusted workflow would be required to set the database flag.
- User approval tokens are one-use, short-lived, stored only as hashes, and bound to the device, issue, exact normalized summary and session. Repair-case creation remains local-only.
- The example is a hackathon prototype, not a production multi-user service; add authenticated identity/authorization, tenant isolation and deployment-specific abuse controls before public use.


## Repository boundaries

Browser-facing files are under `frontend/`; API, domain logic, MCP, persistence, agent integration, utilities and integration tests are under `backend/`. Root configuration coordinates the workspace without mixing application source folders.
