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

## Controller-to-worker reference handshake

The controller now publishes an arm envelope while its monitor process is still running. A background child keeps the two-minute read-only lease under monitoring across artifact upload. The parent checks that the child is alive and the arm has sufficient remaining time before publishing it. A monitoring step then checks process liveness and waits for the result. Job-end process tracking is retained; controller logs and PID files are excluded from artifacts.

The separate worker job resolves the exact-source controller run and arm artifact, requires the controller monitoring step to be in progress, and downloads the immutable artifact using the platform's authenticated cross-run download action. It checks lease digest, source/plan/account binding, named isolation checks, current authoritative run/job states and different runner IDs. Arms older than 90 seconds or with less than 30 seconds before cleanup are rejected. Completed/stopped controllers, changed leases, wrong identities and any attempt to promote the reference to paid authority are rejected.

`LIVE_REFERENCE_HANDSHAKE_PASS` proves this source-bound exchange between active GitHub runners. The worker receives no DigitalOcean credential. Provider mutations remain forbidden and final R6 acceptance stays false. The current monitor is read-only and its two-minute lease is a protocol reference, not a production supervisor or an authorization to create paid compute. Actual deletion, protected credential/scope linkage, restart/reconciliation and guest execution attestations remain required separately.

## Fixed-deadline process recovery reference

The reference controller persists its lease before arming. A supervisor can restart its owned Node process once using the same checkpoint, source, plan, account, execution and lease identifiers. Invalid checkpoints block recovery; they never cause a new lease to be minted. Recovery accepts an expired original lease for immediate reconciliation and never extends its deadline.

The read-only GitHub reference deliberately kills the controller child with SIGKILL after publishing its arm, verifies process identity from its command line before signaling, restarts it on the same host, and requires a result with the original lease digest and expiry. The supervisor retains its protected credentials; the worker still receives no provider credential. The recovery artifact distinguishes same-host process recovery from host-loss/platform-outage recovery, which remains unattested. No provider mutation or paid resource is introduced by the fault injection.

## Replacement-runner reconciliation reference

After the controller completes, a separate replacement job downloads its immutable checkpoint artifact. Authoritative job metadata must show different runner IDs for the predecessor and replacement jobs. The predecessor must have succeeded and the original lease must already be expired. Source, plan, account, execution/lease identity and lease digest are checked before any provider read.

The replacement runner restores the original lease and immediately performs read-only account/inventory reconciliation. It refuses a changed lease, unfinished predecessor, same runner, unexpired checkpoint or different source. The deadline is never renewed. This demonstrates expired-checkpoint transfer and reconciliation on another GitHub runner. Unexpected host loss and platform outages are not injected, and actual paid-compute cleanup remains unattested. The replacement reference also hard-denies provider DELETE and cannot create resources.
