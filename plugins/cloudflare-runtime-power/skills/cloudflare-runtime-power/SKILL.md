---
name: cloudflare-runtime-power
description: Discover the user's Cloudflare accounts and Workers, Pages, D1, and R2 metadata through the official MCP, and prepare bound inspection selections. Use for Cloudflare Runtime Power, Cloudflare inventory, project discovery, or safe resource selection. Version 0.1.0 is inspection-only; do not use it to deploy, delete, create credentials, or change permissions.
---

# Cloudflare Runtime Power

Use the user's existing authenticated official Cloudflare MCP when available. Discover the actual tool namespace; do not assume a particular custom plugin name or account ID. If no connection is available, explain the exact missing connection. Never request passwords or tokens in chat.

1. Call the MCP whoami tool. Keep its stable profile id only in transient execution input. Do not use email as identity.
2. Search the official API spec for GET /accounts, Workers scripts, Pages projects, D1 databases and R2 buckets before execution. If the schema has changed, stop with a schema-drift result.
3. Run scripts/build-mcp-code.mjs using Node and a JSON stdin object. Required: profileId. Optional: projectKey, accountId, planSha256, selection {kind,resourceId}. Never include credentials. Use a project-specific authoritative plan hash only when supplied/verified; otherwise the builder labels its plan as a plugin recipe, not Runtime authority.
4. Pass the generated async-arrow code to the official MCP execute tool. The bundled program performs GET only. It discovers accounts first, selects automatically only when exactly one account exists, and rejects a foreign account. When multiple accounts exist, present the observed accounts for explicit selection rather than guessing.
5. Call whoami again after execution. If the stable profile id changed, discard the result and report PROFILE_CHANGED. The embedded whoami callback is an execution-scoped identity snapshot; this outer recheck is required.
6. Report observed product counts and UNKNOWN states, catalog/selection digest and zero mutations. R2 scope is default jurisdiction only. Do not expose emails, secrets, configuration contents, raw provider errors, or user ids in the answer.
7. Refresh discovery for each new request or after reconnect. Do not reuse catalogs across users/accounts/projects or beyond 60 seconds. Never interpret catalog hashes as trusted signatures or proof of cross-user OAuth isolation.

Use the bundled runtime-power-v1.mjs as the execution implementation. Verify its hash through the builder; do not rewrite it ad hoc. A selected resource is an INSPECT plan only. Product names do not establish project ownership.

Keep v001 mutations, paid creation, credential issuance and Runtime acceptance disabled. If the user asks for deployment or token issuance, state that this version lacks that implementation and keep it outside this workflow. The bundled official MCP itself may expose write tools: workflow instructions are not a server-side authorization boundary. Retain the user's provider permissions and platform review.

For installation or onboarding, verify the official MCP connection and perform discovery; do not claim installation just because files exist. Keep personal/workspace publication separate from public directory publication. Never publish or share credentials.
