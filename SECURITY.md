# Security policy

Fify has a public, read-only ChatGPT integration and an open-source development surface.

Please report suspected vulnerabilities with GitHub's private **Report a vulnerability** flow on the repository's Security tab rather than opening a public issue. Include the affected package, reproduction steps, potential impact, and any suggested mitigation. Do not include live API keys, private application data, or credentials in reports.

Maintainers will acknowledge a report as soon as practical, investigate it privately, and coordinate disclosure after a fix or mitigation is available. The project does not currently promise a fixed response-time SLA.

## Important boundaries

- Model-generated plans are untrusted input and must be validated.
- Registered capabilities must enforce server-side authentication and authorization.
- Confirmation-required UI does not replace authorization, idempotency, or audit logging.
- External data included in planner context may contain prompt injection and should be minimized and isolated.
- The public ChatGPT integration does not request or accept an end-user provider API key.
- Browser-demo API keys, when explicitly configured by a developer, are forwarded to the configured model provider for the current request and are not intentionally persisted.
- Local browser keys live only in that tab's session storage; closing the tab clears them under normal browser behavior.

Fify does not execute consequential real-world mutations. Do not submit sensitive personal data or credentials to the hosted app.
