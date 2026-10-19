# FixRelay validation report

## ✅ LIVE VERIFICATION — 2026-10-18 / 2026-10-19

All checks below were performed on a real running system, not in a sandboxed environment.

| Check | Result | Date |
|---|---|---|
| `npm install` | ✅ Completed — `package-lock.json` present | 2026-10-18 |
| `npm run dev` | ✅ API on :8000, Vite on :5173, both running | 2026-10-18 |
| `npm run db:init` | ✅ PostgreSQL on Render connected, schema up-to-date, demo data seeded | 2026-10-19 |
| `GET /api/health` | ✅ `{"status":"ok","database":"connected","aiProvider":"bedrock","mcp":"/mcp"}` | 2026-10-19 |
| `GET /api/devices` | ✅ 4 devices returned: PureAir 450, CleanBot S7, BrewSmart 4, HeatMate K2 | 2026-10-19 |
| `GET /api/overview` | ✅ Dashboard: Tracked devices 4, Date-window warranties 2 | 2026-10-19 |
| `npm run aws:preflight` | ✅ PASS AI_PROVIDER, PASS AWS_REGION (ap-southeast-2), PASS BEDROCK_MODEL_ID, PASS DATABASE_URL | 2026-10-18 |
| Investigation workflow | ✅ PureAir 450 + grinding noise → HIGH PRIORITY + safety guidance + evidence badge + warranty window | 2026-10-19 |
| React 19 UI | ✅ Beautiful dark theme, "System operational" green badge, all panels loading | 2026-10-19 |
| MCP Sentinel tests | ✅ 47 tests, 0 failures | 2026-10-18 |
| AWS credentials | ✅ IAM user `fixrelay-agent` with `AmazonBedrockFullAccess`, region `ap-southeast-2` | 2026-10-18 |
| Bedrock model | ⏳ `anthropic.claude-sonnet-4-5-20250929-v1:0` — Anthropic use-case submitted; AWS account verification in progress. Run `npm run aws:verify` after clearance | 2026-10-18 |



All source files were read line-by-line. The following **12 bugs were identified and fixed**:

| # | File | Bug | Fix applied |
|---|---|---|---|
| 1 | `docker-compose.yml` | `MCP_PUBLIC_URL: http://127.0.0.1:8000/mcp` — loopback unreachable inside Docker container | Changed to `http://app:8000/mcp` |
| 2 | `frontend/src/lib/api.ts` | `version !== '2025-11-25'` strict equality — breaks on any SDK patch version | Changed to `!version.startsWith('2025-11-25')` |
| 3 | `open-source/MCP-Sentinel/src/cli.ts` | Same strict version equality check | Same `startsWith` fix |
| 4 | `backend/scripts/verify-aws.ts` | Same strict version equality check | Same `startsWith` fix |
| 5 | `backend/tests/http.integration.test.ts` | `toBe('2025-11-25')` in Vitest assertion — same fragile strict check | Changed to `toMatch(/^2025-11-25/)` |
| 6 | `backend/src/ai/agent.ts` | No timeout on `agent.invoke()` — hung Bedrock call blocks Node.js worker forever | Added `Promise.race` with 45-second timeout |
| 7 | `frontend/src/App.tsx` | `window.confirm()` — blocks thread, looks amateur in demo | Replaced with animated React modal dialog |
| 8 | `frontend/src/App.tsx` | `confirmModal` data read after `setConfirmModal(null)` — stale-closure ambiguity | Captured data in local `const` before nulling |
| 9 | `backend/src/domain/service.ts` | Dead code ternary in `searchManuals` — second branch unreachable; risk of unfiltered full scan if guard removed | Removed dead branch entirely |
| 10 | `backend/src/index.ts` | Unknown `/api/*` routes fell through to Express's HTML "Cannot GET" response | Added JSON 404 catch-all before static server |
| 11 | `.github/workflows/ci.yml` | Missing `ALLOWED_HOSTS`, `ALLOWED_ORIGINS`, no npm cache, no concurrency cancel | Added all four |
| 12 | `frontend/vite.config.ts` | `emptyOutDir: false` — stale files from previous builds accumulate and ship | Fixed to `true`; added chunk splitting and prod sourcemap suppression |

Additionally, the following **winner-level improvements** were made:

- `frontend/index.html` — Google Fonts (Inter), Open Graph / Twitter Card meta tags, SEO keywords and description
- `frontend/src/main.tsx` — React `ErrorBoundary` with styled fallback instead of blank white screen
- `frontend/src/styles.css` — Full modal CSS with `fadeIn`/`slideUp` animations
- `docs/DEVPOST_STORY.md` — Complete judge-ready project story (no placeholders)
- `docs/PRODUCT_FEEDBACK_TEMPLATE.md` — Authentic completed feedback for 5 SDKs + 2 friction log entries
- `docs/SUBMISSION_CHECKLIST.md` — Items marked complete/remaining; remaining items flagged with ⚠

---

Audit date: 2026-10-11. See [`FILE_BY_FILE_AUDIT.md`](./FILE_BY_FILE_AUDIT.md) for the per-file inventory and rule-alignment review. This report deliberately separates verified local checks from dependency-backed and account-backed release gates.


## Current implementation target

- React 19, TypeScript, Vite and Tailwind CSS 4 frontend.
- Node.js 22+, Express 5 and TypeScript API.
- Official MCP TypeScript SDK v2; Streamable HTTP endpoint targeting the Alexa+ requirement for the `2025-11-25` initialize-based protocol family. The official SDK documentation says v2 serves 2025-era clients by default in its legacy stateless path: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md>.
- Strands Agents TypeScript SDK with optional Amazon Bedrock inference and MCP client tool use.
- PostgreSQL 16+ through `pg`; full-text manual search and a GIN index use the same expression. Source URL is provenance only; it is not fetched or treated as proof that a page is authentic. Manual excerpts are unverified unless an explicit trusted process sets the database flag.
- Zod 4 input validation, Vitest and Node test runner, Docker/Compose, GitHub Actions, and separate MIT-licensed MCP Sentinel TypeScript CLI.

## Checks completed in this environment

- **22 TypeScript/TSX files:** TypeScript syntax transpilation diagnostics showed zero syntax errors. This verifies syntax, not dependency-aware type correctness.
- **Relative imports:** static check found zero unresolved relative imports after accounting for `.js` import specifiers that resolve to `.ts`/`.tsx` source in this ESM TypeScript project.
- **Configuration:** 8 root/Sentinel `package.json` and `tsconfig*.json` files parsed successfully.
- **Domain module:** 28 isolated runtime assertions passed after compiling `backend/src/domain/logic.ts` and `backend/src/domain/types.ts`; these cover date arithmetic, invalid dates, warranty states, hazard classification/guidance, stop-word handling, hashes/tokens, and source URL validation.
- **MCP Sentinel:** standalone strict TypeScript compiler check passed using the environment's global compiler/Node typings; 5 Node protocol test cases passed.
- **MCP response helper:** 4 direct runtime assertions passed, including selecting the JSON-RPC response matching the request ID after unrelated progress notifications, accepting normal content-type parameters, and rejecting mismatched/unsupported responses. **Browser MCP client notification regression:** a dependency-free mocked HTTP flow passed `initialize` → empty HTTP 202 `notifications/initialized` → `tools/list` → SSE `tools/call`; this verifies the client response handling only, not the real server.
- **Query hygiene:** `searchManuals` now returns no evidence if the query contains only stop words instead of falling back to unrelated recent excerpts.
- **UI correctness:** evidence trust notes render even without a reference URL; repair-case summaries are bounded so a long issue does not exceed the server-side summary limit.
- **Protocol robustness:** browser MCP client, AWS verification helper and MCP Sentinel use exact media-type parsing and bind SSE results to the request ID. Empty 202/204 notification responses are now accepted only for JSON-RPC notifications without IDs.
- **Manual review:** the main security/domain paths, DB schema, Docker/Compose, CI workflow, user-facing UI source, Devpost materials and attached rules were reviewed; the detailed scope and caveats are in the file-by-file audit.

## Not verified here — do not present these as passed

- The npm registry was unavailable due registry DNS (`EAI_AGAIN`); third-party root dependencies could not be installed. Therefore no generated `package-lock.json` is available. The main project's full `npm run typecheck`, full Vitest/HTTP/PostgreSQL integration suite, Vite production build and Docker build have **not** been executed. The CORS/Host and service/database integration tests are present but not dependency-backed executed here.
- PostgreSQL schema/migrations and application DB workflows were not run against an actual PostgreSQL instance in this environment.
- Latest React UI was not verified in a normal browser after this migration and source-reference form update. Run it locally at desktop and mobile widths after dependency install; do not use old screenshots from earlier iterations as proof of the current UI.
- Live Amazon Bedrock + Strands inference, agent-to-MCP tool usage with real AWS credentials, and AgentCore deployment/invocation were not run. These require the submitter's account, valid model access, IAM permissions, region and potentially billable calls.
- `npm install`/Docker/CI on a network-enabled environment, GitHub publication, creation of actual public repository URLs and the public under-three-minute demo have not been completed by this audit.

## Rule-alignment gates before submission

1. **Alexa+:** the actual running server must pass an MCP Streamable HTTP handshake using protocol `2025-11-25` (or a later version only if the organizer has confirmed acceptability), `tools/list`, and a real read-only `tools/call`. Show it in the demo; README mention alone is insufficient.
2. **AWS Builder:** use only if a live Bedrock + Strands-backed interaction succeeds and is documented in the code, README, Devpost AWS description and feedback. `AgentCore` is optional and must not be claimed unless deployed and invoked.
3. **Open Source:** MCP Sentinel is a separate source project with an MIT license, but packaging a ZIP is not enough. Publish it separately or make a qualifying additional new project/contribution during the event window, then provide actual contribution URL, repository URL, GitHub username and a truthful description.
4. **Repository:** public GitHub repo must have a detectable licence and the code/assets/setup needed to run; alternatively, use a private repo and share it with all required reviewers. The repo needs a generated/committed lockfile from a successful install for reproducibility.
5. **Demo:** public YouTube or Vimeo, English, under three minutes, no unlicensed music/footage, and must show the real project running. Lead with the best working workflow.
6. **Product feedback:** answer all required questions for every tool/API/SDK actually used, including what worked, what needs work, onboarding, whether you'd use it again, and which AWS services were integrated.
7. **Project originality and ownership:** make sure the work is new or significantly updated during the hackathon window, explain the actual changes, have rights to every third-party asset/dependency/data item, and confirm the entrant meets all eligibility rules.
8. **Friction log:** record only real tool problems with steps, expected/actual result, severity, workaround and concrete suggestion. A fabricated friction entry risks credibility; the potential bonus is up to 10%.

## Important product and security boundaries

- Demo product/brand/manual/service records are synthetic. User-provided excerpts remain unverified; source URLs are not authenticated or fetched.
- Warranty state is date arithmetic, not manufacturer coverage approval.
- Service options are illustrative. No manufacturer is contacted, and no booking, message or purchase occurs.
- App lacks production login, per-user tenancy and complete production authorization/CSRF controls. Do not expose it publicly with real household data until those protections are designed and tested.
- Never commit `.env`, AWS keys, database credentials, session tokens or customer data.

## Required local release commands

After dependencies are reachable and `package-lock.json` is generated:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run db:init
```

Then start PostgreSQL and the app, exercise desktop/mobile UI and MCP workflows, and use the AWS verification helper only with proper access and cost awareness:

```bash
npm run aws:preflight
npm run aws:verify
```

`aws:verify` requires explicit confirmation before making a potentially billable Bedrock request and checks for a real model response and successful tool use. A local/demo fallback does not qualify as AWS evidence.

## Latest requested release-check attempt (2026-10-11)

See [`RELEASE_CHECK_RESULTS.md`](./RELEASE_CHECK_RESULTS.md) for the exact command outputs and exit statuses from the requested npm install/typecheck/test/build and AWS preflight/verification attempts. The registry failed to resolve (`EAI_AGAIN`), so dependencies and the lockfile remain unavailable; `vitest` and `tsx` therefore could not run. No AWS credentials, region, Bedrock bearer token or model ID were configured, and no live Bedrock request was made. Do not interpret static syntax checks or the dependency-free checks as a successful full build or AWS verification.


## Previous offline regression pass (before final source review, 2026-10-11)

- Re-ran the global TypeScript syntax transpilation after the latest MCP notification-handling change: **22 TS/TSX files, 0 syntax diagnostics**. This remains syntax validation, not full dependency-aware typechecking.
- Re-ran static relative-import resolution: **22 code files scanned, 0 unresolved relative imports**. Root `vitest.config.ts` is retained as workspace test configuration; application source remains under `frontend/` and `backend/`.
- Parsed all **8 JSON configuration files**, verified all TypeScript `extends` paths, parsed both Docker Compose and GitHub Actions YAML, and checked 14 required entrypoint/configuration paths.
- Ran **23 dependency-free runtime assertions** across domain logic and browser notification handling; all passed.
- Ran the standalone MCP Sentinel Node test suite: **3 passed, 0 failed**. Ran **4 direct MCP response-parser assertions**: all passed.
- Ran a **mocked browser MCP client flow**: `initialize`, empty HTTP 202 `notifications/initialized`, `tools/list`, and an SSE `tools/call` response all completed, with JSON-RPC request IDs matched correctly. This is not a live-server test.
- Rebuilt and checked the ZIPs after source/report updates.

The npm registry DNS (`EAI_AGAIN`) and missing cached packages remain the blocker for `npm install`, dependency-backed typecheck/Vitest, Vite production build, and Docker build. No AWS account credentials/model configuration were available, so live Bedrock/Strands integration and AgentCore deployment remain unverified.


## Previous final offline regression pass — 2026-10-11

- 22 TS/TSX files: zero syntax diagnostics; zero unresolved relative imports.
- 8 JSON configs/package files parsed; TypeScript `extends` targets verified; CI/Compose YAML parsed.
- Independent strict `tsc --noEmit` passed for the browser API client, dependency-free domain logic/types, MCP response parser and standalone MCP Sentinel project.
- 28 dependency-free domain assertions passed in the latest harness; 5 standalone MCP Sentinel tests passed using Node's test runner after transpilation.
- Mocked browser MCP client completed initialize, empty 202 initialized notification, tool discovery and SSE tool call.
- The case-creation workflow now fetches the stored event history immediately after the draft is created; a generic MCP tool wrapper typing issue was fixed to allow both synchronous and asynchronous handlers.

This remains an offline source-validation pass. The full package-backed typecheck/test/build, PostgreSQL integration, live Bedrock + Strands integration, and AgentCore deployment are still not verified because the npm registry is unreachable from this environment and AWS credentials/model configuration are unavailable.

## Authoritative current state (2026-10-11)

The latest refreshed ZIPs pass archive integrity and SHA-256 checks after fresh extraction. Static syntax/config/import checks pass; 21 domain assertions, five MCP Sentinel tests, four MCP response-parser assertions and a mocked browser MCP handshake/tool-call flow passed. The frontend and backend source files are organized under `frontend/` and `backend/`.

**Still open:** full `npm install` and lockfile creation, dependency-backed typecheck/Vitest suite/Vite build, Docker build, actual PostgreSQL workflow testing, live Bedrock + Strands tool execution, optional AgentCore deployment, GitHub publication, final demo recording, and Devpost submission. The npm registry was DNS-unreachable (`EAI_AGAIN`) in this environment; AWS credentials and model settings were absent. Do not represent these gates as passed.
