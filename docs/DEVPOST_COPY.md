# Devpost public-page draft — FixRelay

## Project name

**FixRelay — Evidence-Grounded Home Repair Agent**

## Elevator pitch (under 200 characters)

Turn household device issues into evidence-backed next steps with an MCP-powered agent, transparent warranty date checks, source-labelled references and user-approved repair-case drafts.

## Suggested Built With tags

React, TypeScript, Tailwind CSS, Node.js, Express, PostgreSQL, Model Context Protocol (MCP), Streamable HTTP, Strands Agents, Amazon Bedrock, Zod, Vitest, Docker.

Remove any tag for a technology that is not actually used in the final submitted code or that was not meaningfully integrated.

## About the project

### Built during the hackathon window

FixRelay was created entirely within the Amazon Developer Hackathon submission period (August 31 – October 23, 2026). All source code, the MCP Streamable HTTP server, the Strands + Bedrock agent integration, the PostgreSQL schema, the approval-token security model, the React 19 frontend, and the MCP Sentinel open-source CLI were written during the submission window specifically for this hackathon.

### The problem

A household device issue often begins with incomplete context: the exact model, the purchase date, what the manual actually says, and what action is safe. A generic chatbot can provide a plausible answer without showing what the answer is based on or distinguishing a suggestion from a completed action.

### What FixRelay does

FixRelay provides one workflow that matches a device record, retrieves source-labelled excerpts, calculates a warranty date window from user-recorded values, gives conservative safety guidance, and prepares a local repair-case draft after explicit confirmation. It exposes its domain actions through a Streamable HTTP MCP server and includes a developer lab that shows initialization, tool discovery and actual tool calls.

### How it was built

The app uses React and TypeScript with Tailwind CSS for the interface, Node.js/Express and TypeScript for the API, PostgreSQL for persistence, and the official MCP TypeScript SDK for the MCP server. The optional live AI path uses the Strands Agents TypeScript SDK and Amazon Bedrock. MCP Sentinel is a separate open-source tool for smoke-testing MCP endpoints.

### Safety and source transparency

The seeded product records and sample reference excerpts are synthetic demo data. Users can attach a permitted excerpt and an optional URL from the Devices form; user-provided text remains unverified and the URL is displayed only as provenance. Warranty output is date arithmetic, not an insurer/manufacturer decision. Service options are illustrative. A repair case is a local draft; the app does not contact a provider or book a service.

### What we learned

    MCP Streamable HTTP is more nuanced than the getting-started guide implies. SSE framing, multi-line data: continuation, empty HTTP 202 notification acknowledgements, and header-vs-body protocol-version placement are all silent failure points. Writing MCP Sentinel as a second independent client exposed several mismatches that only appear when client and server make different assumptions about the protocol.

    Evidence provenance requires deliberate, explicit design at every layer — database column, UI badge, agent system prompt. "Source label" is not "verified." Each layer had to consistently distinguish synthetic demo excerpts from content that passed a real verification process.

    Approval boundaries are a security control, not just a UX affordance. The single-use token started as a user-confirmation mechanism. Extending it to bind the full normalised draft hash (device + issue + summary + session) turned it into a meaningful replay-prevention control for the MCP mutation path.

    Timeout discipline matters for AI agents. Without an explicit Promise.race and a 45-second limit, a slow Bedrock response blocks a Node.js worker indefinitely. The SDK does not expose a built-in timeout parameter.

## AWS Builder description draft

Use only after the live integration has actually been run and verified:

“FixRelay uses Amazon Bedrock through the Strands Agents TypeScript SDK to reason over user prompts and call FixRelay tools exposed through MCP. The agent is instructed to ground claims in retrieved references, preserve source labels, avoid unapproved state changes, and prioritize safety. The source includes setup and verification steps. The submitted demo shows the actual Bedrock response and associated tool execution.”

Edit this text to match the model, tools and AWS components you truly used. If AgentCore was not deployed, do not say it was.

## Open Source description draft

Use only after publishing the independent MCP Sentinel repository and a qualifying hackathon-window contribution. Include the actual GitHub URLs and account name. Explain which checks are new, show their tests and document their limits. Merely open-sourcing FixRelay does not satisfy the additional Open Source mini-challenge by itself.
