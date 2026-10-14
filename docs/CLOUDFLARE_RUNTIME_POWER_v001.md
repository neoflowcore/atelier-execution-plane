# Cloudflare Runtime Power v001
Experimental Execution Plane extension, authorized separately from the existing R6 qualification. It does not change Runtime/Pilote authority, admission, historical seals, or Horizon 2 start conditions.

## First implementation
The injected official MCP/API adapter supplies authenticated whoami() and request(). No account, user, project or credential is hardcoded. Discover authorized accounts before selection; multiple accounts require an explicit account. Bind profile before and after discovery. Discover Workers, Pages, D1 and default-jurisdiction R2 metadata only. Complete supported page/cursor sequences; denied, malformed, looping and truncated observations remain UNKNOWN, never empty/zero.

Catalogs contain allowlisted resource identifiers/names, a profile digest, source/plan/project binding, observation time and content digest. They exclude emails, resource contents, environment variables, keys, raw diagnostics and credential values. A source/project/account/profile-bound selection checks catalog integrity and 60-second freshness; it produces INSPECT only. This is an application integrity digest, not a trusted signature or proof of cross-user isolation.

## Execution boundaries
v001 makes GET calls only. It cannot deploy, delete, bill, create credentials, grant authority, or accept Runtime results. The injected authenticated adapter and its OAuth session are the security boundary. Untrusted serialized catalogs are not permission grants; consumers must use the current authenticated profile/account. Provider-side authorization remains required on every operation.

R2 discovery is explicitly default-jurisdiction only, not an account-wide billable residue scan. Product names do not imply project membership. Select exact resource IDs; no automatic inference from similar names.

## Next development
1. Runtime-authorized minimal change plans with fresh state comparison, bounded outcomes and authoritative readback.
2. Deployment/version verification and recovery receipts, without promoting deployment success into application acceptance.
3. Credential creation and immediate server-side Secret transfer with expiry and compensating revocation; no secret tool outputs.
4. Actual separate-user OAuth install/access-denial trials. Current fixtures do not prove real cross-user isolation.
5. Package personal workflow/plugin only after the execution contract and adapter are verified; retain the official Cloudflare MCP.

## Validation
Fault coverage includes account ambiguity/foreign selection, profile changes, denied reads, both pagination types, cursor loops, duplicate resources, stale/wrong-bound catalogs and tampering. Canonical CI is required; no live mutation or credential issuance is part of v001.
