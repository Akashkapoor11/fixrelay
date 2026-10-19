# Contributing

Thanks for considering a contribution to FixRelay or MCP Sentinel.

## Before opening a change

1. Explain the user problem and the expected behaviour.
2. Keep claims grounded in evidence. Label synthetic fixtures and user-provided documents clearly.
3. Add regression tests for bugs and protocol/security changes.
4. Never commit `.env`, credentials, customer data, downloaded manuals without redistribution rights, or generated secrets.
5. Keep the primary application and the standalone MCP Sentinel tool independently runnable.

## Local workflow

```bash
npm install
cp .env.example .env
# Start PostgreSQL using Docker Compose, or configure DATABASE_URL for your own server.
npm run db:init
npm run typecheck
npm test
npm run build
```

For MCP Sentinel alone:

```bash
cd open-source/MCP-Sentinel
npm install
npm test
npm run build
```

## Pull requests

Include a concise summary, tests executed, screenshots for visible UI changes, and notes for any environment-dependent checks. Do not say a test passed if it was not run. AWS tests must state whether they used real AWS credentials and may incur charges.
