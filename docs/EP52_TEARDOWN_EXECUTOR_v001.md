# Lease-bound teardown executor

The teardown watchdog now has an executable service and an official DigitalOcean API adapter. It does not create resources or authorize R6 admission. Existing pure watchdog decision functions remain unchanged.

`scripts/run-do-teardown-watchdog.mjs` accepts one lease JSON file and receives the existing `ATELIER_R6_DO_TOKEN` through the protected executor environment. It checks the current repository context, exact checked-out source, authoritative plan digest and expected DigitalOcean account. No raw token is included in a lease or receipt. The environment entry is removed after constructing the private API client.

The lease uses schema `EP52_TEARDOWN_LEASE_V1` and fields `executionId`, `leaseId`, `sourceSha`, `planSha256`, `accountUuid`, `issuedAtMs`, `expiresAtMs`. Its duration must be positive and at most 1,800,000 milliseconds. Provisioning may consume time inside this lease; it must never reset the deadline after create.

The service checks account and complete owned inventory before persisting its armed receipt. Cleanup starts 180 seconds before lease expiry by default, reserving time for provider calls and reconciliation; a shorter lease begins cleanup immediately. At that time it rechecks both ownership tags and creation time against the lease window. Ambiguous, foreign, pre-existing or rebound resources cannot be deleted. Child inventory is inspected before deleting only the owned Droplet. Unknown child inventory does not retain paid compute, but blocks residue-zero acceptance. The service reconciles a lost DELETE response with GET/404 before considering any retry. Retries are bounded and ownership is rechecked. Existing child resources are preserved. This margin does not guarantee a deadline under provider unavailability or controller loss; independent deployment and live deadline evidence remain required.

Receipts distinguish absence at expiry, observed owned cleanup, and unresolved cleanup. Empty inventory is not proof of DELETE capability or previous child cleanup. `finalR6Acceptance` is always false. Account-wide residue zero is not claimed.

## Deployment requirement

The service must run on a separately supervised, trusted controller with protected credentials, durable lease/receipt storage and automatic restart/reconciliation after controller interruption. A process, a CI job, or an armed JSON file alone does not establish an independent failure domain. The armed receipt therefore has `independentFailureDomainAttested=false` and `paidCreateAuthorized=false`.

The current CLI is an explicit execution entrypoint; it is not automatically started on PRs and no paid provisioning is enabled. Do not put the provider credential on the compute guest. Before provisioning, an orchestrator must demonstrate the controller's live identity, isolation from the worker's failure domain, durable arming, deadline enforcement, deletion/readback and credential cleanup. Existing R6 preprovision checks remain required.

## Validation limits

Semantic tests cover expiry ordering, failed arming, account mismatch, ownership collision/rebinding, pre-existing resources, TTL limits, unknown children, preserved children, DELETE-response loss, bounded provider failure, absence-without-delete, forbidden API paths, complete pagination, foreign-resource preservation and a separate worker process killed with SIGKILL. These are local/provider-simulated proofs. The process-kill case proves separate-process survival on the same host; it does not prove survival of host loss or a DigitalOcean live teardown.

## Existing GitHub infrastructure reference

When no existing management server is available, `.github/workflows/r6-watchdog.yml` runs a separate source-bound controller reference on a GitHub-hosted runner. It has a distinct workflow and concurrency group from `verify.yml` and only read permissions. The controller uses GitHub's authoritative run/job API to require different workflow IDs, run IDs and runner IDs for the same repository, branch and source. It observes the peer verification job completing successfully while its own controller job remains running.

The reference then uses the existing repository Secret to authenticate DigitalOcean account/inventory reads and persists a short-lived lease, armed receipt and result. An additional wrapper hard-denies DELETE, so this job cannot mutate DigitalOcean even if a resource collision appears. Artifacts contain no credential values.

This closes discovery and deployment of a separate-runner read-only reference on existing GitHub infrastructure. It does not prove paid-compute deletion, platform-outage survival, durable restart after controller-host loss, or a live creation/arming handshake. It never sets paid-create authority or final R6 acceptance. A later live controller/worker pair must provide those required attestations before provisioning.
