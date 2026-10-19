# File-by-file release audit — FixRelay

Audit date: 2026-10-11 (Asia/Kolkata). This is a source/configuration/documentation audit of the current working tree, not a claim that all dependency-backed runtime behavior has been executed.

## Decision summary

- **Source syntax:** 22 TypeScript/TSX files transpiled for syntax diagnostics; 0 syntax errors.
- **Relative import scan:** 0 unresolved relative imports after accounting for TypeScript's `.js` specifier convention.
- **Configuration files:** 8 package/TypeScript JSON files parsed successfully.
- **Domain logic:** 28 isolated runtime assertions passed in the latest dependency-free harness after compiling the domain module.
- **MCP Sentinel:** standalone strict TypeScript check passed with the globally available compiler/type definitions; 5 Node test cases passed.
- **MCP response parser:** 4 direct assertions passed, including matching an SSE response to the initiating JSON-RPC ID.
- **Full main-app `npm run typecheck`, Vitest/API/PostgreSQL suite, Vite production build and Docker build:** **not verified** because npm registry DNS failed in the authoring environment and third-party packages could not be installed. No lockfile was generated.
- **Live Amazon Bedrock/Strands inference, AgentCore deployment, final full-app browser run, and public GitHub/Devpost publication:** **not verified**; these require working external access/accounts and submitter actions.


## Source folder separation

- `frontend/` contains the React entry (`index.html`), UI source (`src/`), Vite config, and frontend TypeScript configuration.
- `backend/` contains the API entry (`src/index.ts`), database schema/migrations, domain services, MCP server, optional AI agent, backend scripts, backend tests, and backend TypeScript configurations.
- Root-level `package.json`, `tsconfig.json`, `vitest.config.ts`, Docker/Compose, CI workflow and documentation are workspace-level configuration, not application frontend/backend source.

## Rule alignment from the attached Overview and Official Rules

1. **Alexa+ track:** the implementation target is a self-hosted MCP server over Streamable HTTP speaking the `2025-11-25` initialize-based protocol family. The official MCP SDK v2 docs describe support for the 2025-era handshake. The source has runtime MCP registration and routes, not merely README mention. Still, the final dependency-installed runtime check must pass and the demo must show it.
2. **AWS Builder:** Bedrock + Strands integration code and a verification script are present. This does **not** establish the mini-challenge eligibility until an actual Bedrock-backed agent invocation and its MCP tool use are demonstrated and documented. AgentCore is optional and must not be claimed unless deployed and invoked.
3. **Open Source:** MCP Sentinel is a separate MIT-licensed project. It only qualifies if the entrant publishes its repository or completes the required additional new project/contribution during the hackathon window and supplies the real URL, repository URL, GitHub username, and an honest description in Devpost. Packaging alone is not qualification.
4. **Repository/demo requirements:** public GitHub repository must have a visible licence (or private repository shared with the designated reviewers); full source/setup instructions; public English YouTube/Vimeo demo under 3 minutes; all product feedback fields; accurate track/mini-challenge boxes; optional feature requests/friction logs only if truthful.
5. **Originality/ownership:** entrant must ensure the final project is their eligible original work, has been created or significantly updated within the hackathon period, and all third-party code/assets/data are used under their licences. Do not claim the sample data is real manufacturer data.
6. **Judging:** implementation, design, impact, and idea quality are equally weighted; a genuine friction log may earn up to 10% bonus. No project can guarantee first place.

The official requirements can be checked at the [Overview](https://amazonappdev2026.devpost.com/) and [Official Rules](https://amazonappdev2026.devpost.com/rules) pages. The attached rule text is the baseline for this audit.

## File-by-file review

Frontend application source is contained in `frontend/`; backend application code, backend scripts, backend tests and optional AgentCore deployment documentation are contained in `backend/`. Workspace-level config, CI, Docker/Compose, and general docs remain at the root. The status in the third column describes the scope of this audit; it is not equivalent to a successful full-stack runtime build where dependencies/services are marked unavailable.

| File | Purpose checked | Audit status / limitation |
|---|---|---|
| `.dockerignore` | Docker build context exclusions; excludes secrets, generated output, dependency trees and version-control metadata. | Static reviewed |
| `.env.example` | Non-secret environment template for Node server, PostgreSQL, CORS/Host allow-lists and optional Bedrock. | Static reviewed; no real credentials |
| `.github/workflows/ci.yml` | GitHub Actions setup: PostgreSQL service, Node 22 install, typecheck, tests, build and standalone Sentinel validation. | YAML parsed; CI not executed here |
| `.gitignore` | Ignores node_modules, dist, coverage, environment secrets and generated files; does not hide tests or Sentinel source. | Reviewed |
| `CONTRIBUTING.md` | Development workflow, regression-test expectations and truthful reporting guidance. | Reviewed |
| `Dockerfile` | Multi-stage Node 22 build/runtime; copies runtime schema and scripts; installs runtime dependencies. | Static reviewed; Docker unavailable/unrun |
| `LICENSE` | Root MIT licence for the main repository. | Reviewed; contributor must own/authorize submitted work |
| `README.md` | Architecture, setup, demo workflow, truth-in-demo limits, AWS and release-gate instructions. | Reviewed against code and rules |
| `SECURITY.md` | Prototype boundary, secrets, host/origin configuration, TLS and non-production warnings. | Reviewed |
| `backend/aws/agentcore/README.md` | Optional AgentCore path; explicitly says deployment is not verified until deployed/invoked. | Reviewed; AWS path unrun |
| `docker-compose.yml` | Local PostgreSQL and app services with localhost-only published ports and configured environment. | YAML parsed; containers unrun |
| `frontend/index.html` | Vite application entry and metadata. | Reviewed |
| `package.json` | Main project scripts, runtime dependencies and toolchain versions. | JSON parsed; dependencies unavailable, no lockfile |
| `tsconfig.json` | Shared strict TypeScript compiler options. | JSON parsed |
| `vitest.config.ts` | Root Vitest discovery for backend integration/domain tests. | Static config/path review; package-backed suite not run because npm registry was unavailable |
| `frontend/tsconfig.json` | Client/Vite typecheck scope. | JSON parsed |
| `backend/tsconfig.json` | Server build output and scope. | JSON parsed |
| `backend/tsconfig.tests.json` | Test typecheck scope. | JSON parsed |
| `backend/tsconfig.tools.json` | Script utility typecheck scope. | JSON parsed |
| `frontend/vite.config.ts` | React/Tailwind plugins, client output directory, dev port and API/MCP proxies. | Syntax/import scan; Vite build unrun |
| `backend/scripts/mcp-response.ts` | Shared JSON/SSE response parser validates JSON-RPC envelopes and exact request IDs. | Syntax scan; 4 direct assertions passed |
| `backend/scripts/verify-aws.ts` | AWS preflight and explicit live Bedrock/Strands + read-only MCP verification with cost confirmation. | Syntax scan; actual AWS verification unrun |
| `backend/src/index.ts` | Express API, host/origin controls, HTTP routes, MCP route, health, static client and error mapping. | Syntax scan/manual review; Express suite unrun |
| `backend/src/ai/agent.ts` | Optional Strands + Bedrock agent with MCP tools, persisted history and safety/system constraints. | Syntax scan/manual review; dependency typecheck and live AWS unrun |
| `backend/src/db/migrate.ts` | Initializes PostgreSQL schema and seeds demo data. | Syntax scan; PostgreSQL unavailable |
| `backend/src/db/pool.ts` | Pool setup, schema load, fictional seed data, ID generation and transaction helper. | Syntax scan/manual review; PostgreSQL unavailable |
| `backend/src/db/schema.sql` | Tables/indexes/migrations for devices, manuals, repair cases, conversation history, approval tokens and audit. | SQL manually reviewed; actual PostgreSQL execution unrun |
| `backend/src/domain/logic.ts` | Deterministic normalization, warranty arithmetic, risk classification, evidence URL validation and hashes/tokens. | Syntax compile; 28 direct runtime assertions passed in the latest harness |
| `backend/src/domain/logic.test.ts` | Vitest regression tests for deterministic domain logic. | Syntax scan; Vitest suite unrun |
| `backend/src/domain/service.ts` | Shared domain operations, database queries, reference intake, approval-bound case creation and sanitized audit logging. | Syntax scan/manual review; DB integration suite unrun |
| `backend/src/domain/types.ts` | Shared API/domain types. | Syntax scan |
| `backend/src/mcp/server.ts` | Eight MCP tool definitions registered through the official TypeScript SDK; case creation uses explicit approval tokens; shared tool wrapper accepts synchronous and asynchronous domain functions. | Syntax scan/manual review; direct sync/async code review; live MCP server run remains unverified in this environment |
| `frontend/src/App.tsx` | React interface: dashboard, investigation, device/reference intake, repair cases, approvals and MCP lab. Newly created case now reloads stored event history immediately. | Syntax scan; latest UI not browser-tested with full npm dependencies |
| `frontend/src/lib/api.ts` | Typed frontend API calls and browser MCP JSON-RPC client. | Syntax scan; helper assertions and mocked initialize/notification/tools-list/tools-call flow passed; live app integration unrun |
| `frontend/src/main.tsx` | React DOM bootstrap. | Syntax scan |
| `frontend/src/styles.css` | Responsive layout, screen components, form states and evidence trust styling. | Manual/static review; final visual review pending |
| `backend/tests/aws-verification.test.ts` | Tests event-stream matching, JSON-RPC response ID validation and content-type failure handling. | Syntax scan; 4 equivalent direct parser assertions passed; Vitest test itself unrun |
| `backend/tests/http.integration.test.ts` | Host/CORS and HTTP/MCP/PostgreSQL integration coverage. | Syntax scan; Express/PostgreSQL tests not executed |
| `backend/tests/service.integration.test.ts` | Query hygiene, source provenance, warranty, approval, token replay and case-note coverage. | Syntax scan; DB-backed cases not executed |
| `open-source/MCP-Sentinel/.gitignore` | Standalone Sentinel generated-file and secret exclusions. | Reviewed |
| `open-source/MCP-Sentinel/CONTRIBUTING.md` | Standalone project contribution/test policy. | Reviewed |
| `open-source/MCP-Sentinel/LICENSE` | Separate MIT licence for the Open Source deliverable. | Reviewed |
| `open-source/MCP-Sentinel/README.md` | Standalone installation, command examples, scope, usage limits and mini-challenge caveat. | Reviewed |
| `open-source/MCP-Sentinel/package.json` | Standalone CLI metadata, dependencies, build/test/start scripts. | JSON parsed; no standalone lockfile |
| `open-source/MCP-Sentinel/tsconfig.json` | Standalone strict compiler configuration. | JSON parsed; standalone typecheck passed with global TypeScript/Node types |
| `open-source/MCP-Sentinel/src/cli.ts` | CLI argument parsing, HTTP MCP handshake, tool discovery/call and JSON/JUnit reporting. | Syntax scan; standalone compile/test pass |
| `open-source/MCP-Sentinel/src/protocol.ts` | MCP JSON-RPC/SSE parser and tool-list schema validation. | Standalone compile/test pass |
| `open-source/MCP-Sentinel/tests/protocol.test.ts` | Regression tests for MCP result IDs, tool schema, progress/SSE event matching, and empty initialized-notification responses. | 5 Node tests passed with Node built-in test runner after TypeScript transpilation |
| `docs/ARCHITECTURE.md` | Component/data-flow boundaries, trust model and technical references. | Reviewed against source |
| `docs/DEMO_SCRIPT.md` | Demo narration and minute-by-minute sequence under three minutes. | Reviewed against submission rules |
| `docs/DEVPOST_COPY.md` | Draft Devpost name/pitch/story/build tags plus conditional AWS/Open Source copy. | Reviewed; conditional claims must not be used until verified |
| `docs/DEVPOST_STORY.md` | Editable outline requiring real learning/challenge observations. | Reviewed; entrant must complete from actual experience |
| `docs/PRODUCT_FEEDBACK_TEMPLATE.md` | Per-tool/API/SDK feedback worksheet. | Reviewed; must be completed from actual usage |
| `docs/SUBMISSION_CHECKLIST.md` | Rule-mapped checklist for primary track, AWS, Open Source, testing and Devpost. | Reviewed against attached official rules |
| `docs/VALIDATION_REPORT.md` | Current test evidence, blockers and required release gates. | Being synchronized with this audit |
| `docs/FILE_BY_FILE_AUDIT.md` | This inventory, official rule-alignment matrix and release gate record. | Self-referential audit record; generated after inspecting the project source/configuration files |

## Excluded generated files

The `dist/` output is generated and ignored by Git. Generated Sentinel `dist/*.js` files are removed from the source archive to avoid shipping stale compiled output. `node_modules/`, coverage reports, `.env`, and other generated runtime files are not included in the submission ZIPs.

## Issues found and fixed during this final pass

- A stop-word-only evidence query previously fell through to a “latest excerpts” query and could show unrelated evidence. It now returns an empty evidence list, with a regression test present in the service test file.
- User-provided reference URLs are kept as provenance only; UI now always displays the unverified-source note whether or not a URL was provided.
- Long investigation issues could produce an auto-generated repair-case summary beyond the backend's 800-character validation limit. The generated summary now bounds the included issue text.
- MCP JSON/SSE parsing in the shared verifier, browser client and Sentinel now recognizes only exact `application/json` or `text/event-stream` media types (allowing standard parameters) and matches the response to the originating JSON-RPC ID.

## Blocking release steps

1. From a network-enabled environment, run `npm install` and commit the generated `package-lock.json`; also generate/commit the standalone Sentinel lockfile if it will be an independent repository.
2. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. Fix every type/build/test failure; this static audit cannot substitute for that.
3. Start a fresh PostgreSQL 16 instance, run `npm run db:init`, test all UI workflows and MCP handshake from a normal browser, and record the output.
4. Configure AWS model access and run `npm run aws:verify` with cost awareness. Show that the actual Bedrock + Strands path invoked a read-only MCP tool. Only claim the integrations demonstrated in the final submission.
5. Publish the two repositories, verify licence visibility and URLs, create the additional qualifying Open Source contribution if applicable, and fill Devpost fields only with real URLs/observations.
6. Record a truthful public demo under three minutes and re-run the checklist at the exact final commit.



## Latest file-level regression addendum (2026-10-11, final audit)

- **Syntax/import scan:** 22 TypeScript/TSX files checked; zero syntax diagnostics and zero unresolved relative imports. All 8 JSON package/config files parsed, all TypeScript `extends` targets resolved, and the GitHub Actions/Compose YAML files parsed.
- **Independent TypeScript checks:** the dependency-free domain logic/types and MCP response parser passed strict `tsc --noEmit`; the browser API/MCP client passed strict `tsc --noEmit`; the standalone MCP Sentinel project passed its configured strict TypeScript check using the globally available Node typings. These checks do not replace dependency-aware typechecking of the complete app.
- **Dependency-free domain runtime:** 21 direct Node assertions passed, covering date arithmetic, warranty disclaimers, hazard guidance, token/draft hashes and URL validation.
- **Browser MCP client:** a mocked `fetch` flow passed `initialize` → empty HTTP 202 `notifications/initialized` acknowledgement → `tools/list` → SSE `tools/call`, and request IDs were matched. This is client-level mocked verification, not a live server test.
- **MCP Sentinel:** 5 protocol tests passed under Node's built-in test runner after TypeScript transpilation. The mock endpoint returned success for initialization, notification, tool discovery and read-only tool invocation.
- **Additional fixes in this pass:** the MCP tool wrapper now supports sync and async domain methods (so `find_service_options` does not violate its wrapper type); after case creation, the React UI fetches saved case-event history immediately so the approval event appears in the timeline without a manual reopen.
- **Final archive state:** after this audit/report update, the submission ZIPs are regenerated, tested with `unzip -t`, checksum-verified, and checked after fresh extraction. The check does not claim a full npm install, complete app typecheck/Vitest suite, production Vite build, Docker build, PostgreSQL integration test, live Bedrock inference, or AgentCore deployment.

The registry remains DNS-unavailable (`EAI_AGAIN`) in the authoring environment and the AWS credentials/model configuration are not present. Those external release gates must be completed on a network-enabled machine with an authorized AWS account before the project can be called fully verified.

## Authoritative latest status (2026-10-11)

The current source audit reports 22 TypeScript/TSX files with no syntax diagnostics or unresolved relative imports. Twenty-eight dependency-free domain assertions, five standalone MCP Sentinel tests, four MCP response-parser assertions, and a mocked browser MCP initialize/notification/tools-list/tools-call sequence passed. Configuration parsing and archive integrity checks passed. The complete package-installed typecheck/test/build, Docker build, PostgreSQL integration, real browser run after dependency installation, live Bedrock/Strands invocation, and AgentCore deployment are not verified because the npm registry was unreachable and AWS credentials/model configuration were unavailable.
