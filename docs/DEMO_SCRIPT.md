# FixRelay demo script (target under 3 minutes, public English video)

**Before recording:**
- Ensure `npm run dev` is running in a terminal (keep terminal hidden during recording).
- App open at `http://localhost:5173` in a clean browser window (no dev tools visible).
- Reset investigation form — no stale results on screen.
- Hide `.env`, terminal secrets, and AWS account details from screen.
- Set browser zoom to 100% for clear readability.

---

## 0:00–0:15 — Problem and product

**Show:** FixRelay home page — Overview tab, "Make every repair decision with evidence."

**Say:**
> "Every homeowner faces this: an appliance breaks and you don't know if it's safe to keep using,
> whether it's covered by warranty, or what to actually do next.
> FixRelay solves this with evidence — not guesswork.
> It connects your device records, source-labelled manual excerpts, and safe next steps
> into one clear workflow, powered by a real Model Context Protocol server."

---

## 0:15–0:50 — Investigate

**Show:** Type `PureAir 450` in the Device field. Type `The unit is making a grinding noise and there is a burning smell.` Click **Investigate issue**.

**Say:**
> "I report a real problem — my air purifier is making a grinding noise and there is a burning smell.
> Watch what happens. FixRelay classifies this as HIGH PRIORITY immediately.
> It tells me to stop using the device and disconnect power — before anything else.
> This is safety-first by design, not a generic chat response.
> Every piece of guidance is source-labelled. You can see exactly where it came from,
> and whether it is a verified source or a synthetic demo excerpt."

---

## 0:50–1:20 — Evidence and warranty

**Show:** Scroll down to show the warranty date window and the retrieved evidence excerpt.

**Say:**
> "The warranty date window is calculated live from the purchase date stored in PostgreSQL.
> It says Active until February 2028 — that is real date arithmetic, not a manufacturer approval.
> The retrieved evidence is a manual excerpt matched by full-text search.
> It is clearly labelled as a synthetic demonstration excerpt — FixRelay never pretends
> that demo data is a real manufacturer document.
> The recommended next steps are specific: prioritise safety, stop using the device, arrange qualified service."

---

## 1:20–1:50 — Human-controlled case creation

**Show:** Click **Create repair-case draft**, read the confirmation modal, click **Approve**.

**Say:**
> "When the user is ready to act, FixRelay generates a short-lived approval token
> bound to the exact device, issue and summary.
> The user must explicitly read and confirm the draft before a case is created.
> No action happens without user consent — and the token can only be used once.
> A Case ID is created and saved to PostgreSQL with a full audit trail."

---

## 1:50–2:20 — MCP lab

**Show:** Click **MCP lab** in the left sidebar. Show the JSON-RPC initialise, tools/list, and a tool call.

**Say:**
> "Here is what makes FixRelay technically unique.
> This is the MCP lab — a live browser-side Model Context Protocol client
> built to the 2025-11-25 Streamable HTTP specification.
> You can see every JSON-RPC message in real time — the initialise handshake,
> tool discovery, and actual tool execution against the running server at slash mcp.
> This is not a wrapper around a chat API. This is a real agentic protocol implementation."

---

## 2:20–2:50 — AWS Bedrock and close

**Show:** Point to "System operational" badge. If `npm run aws:verify` has been run, show the Bedrock panel response.

**Say:**
> "The backend is fully live — PostgreSQL on Render, Node.js API with Express 5,
> and Amazon Bedrock with the Strands Agents SDK for live AI reasoning.
> AI Provider is set to Bedrock in the environment, using Claude Sonnet 4.5
> in the ap-southeast-2 region with a verified IAM user.
> FixRelay also includes MCP Sentinel — a separate open-source CLI tool
> that any developer can use to smoke-test their own MCP server.
> Thank you."

---

## After recording

- Trim to under 3 minutes.
- Upload to YouTube (public, English captions preferred) or Vimeo.
- Paste the video URL into the Devpost submission form.
- Double-check no credentials, tokens or `.env` values are visible in any frame.
