# Security policy

FixRelay is a hackathon prototype. Do not expose it to the public internet or put real customer, purchase, warranty, home, or identity data into it without a separate security review.

## Reporting a vulnerability

Please do not file public issues containing secrets or exploit details. Contact the repository maintainer privately through the contact mechanism listed on the GitHub repository. Include the affected version, reproduction steps, impact, and any safe mitigation.

## Current security boundaries

- Keep AWS credentials, database credentials, and service tokens on the server. Never place them in `VITE_*` variables or browser code.
- Configure explicit `ALLOWED_ORIGINS` and `ALLOWED_HOSTS` allow-lists before deployment; add the exact deployment hostname and origin, never a wildcard.
- Use TLS for remote PostgreSQL and HTTP traffic; configure `PGSSL=true` only when the database presents a certificate trusted by the runtime.
- Put authentication and per-user authorization in front of any internet-facing deployment. The current prototype does not provide production-ready user identity, tenant isolation, or complete CSRF protections.
- Do not use synthetic demo service availability as real booking information. Do not treat warranty-date arithmetic as a manufacturer's coverage decision.
- Approval tokens are short-lived and single-use, but do not make the overall prototype a production-grade transaction system.

Please rotate any secret that may have been committed or disclosed.
