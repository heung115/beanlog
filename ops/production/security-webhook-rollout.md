# Deployment webhook security rollout

This change is **not applied to production by editing the repository**. The
workflow sender and host webhook receiver must be upgraded together. Do not
roll out the sender alone: the old receiver ignores the additional signed fields
and still permits replay. The new receiver rejects the old sender's payload.

## Contract

The HMAC covers the complete JSON body, including `timestamp` (Unix seconds) and
`delivery_id` (`GITHUB_RUN_ID-GITHUB_RUN_ATTEMPT`). A delivery may be at most five
minutes old or 30 seconds ahead of the receiver. One workflow attempt has one
identity, including all curl retries. Both machines require synchronized time.

Before replacing the trigger, the receiver creates a private ledger record using
exclusive creation, flushes the file and its parent directory, and never consumes
that identity again. Concurrent or restarted-process duplicates return HTTP 409.
The ledger is capped at 10,000 entries and records are retained for 24 hours,
well beyond the signature validity window. Only signed valid requests can create
records. Each record is at most the 64 KiB body limit and has mode 0600.

A ledger I/O error fails closed with HTTP 503. If a crash or trigger I/O failure
happens after consumption, the same delivery stays consumed. Use a new GitHub
workflow run attempt (which changes the delivery ID), or let the verified poller
timer recover; do not delete an active ledger record to retry. Curl retries of a
consumed delivery can make the job report failure even when deployment was
already accepted; check the host poller and deployed SHA before rerunning.

## Coordinated host and GitHub update

1. Schedule a short deployment maintenance window and pause webhook traffic and
   the deployment timer. Record the current installed receiver/poller binaries,
   unit configuration and verified deployed SHA for rollback. Application
   containers can continue serving during this work.
2. Generate a new random secret of at least 32 bytes and install it through the
   existing private secret delivery mechanism in both the host secret file and
   GitHub `DEPLOY_WEBHOOK_SECRET`. Never print the secret or store it in Git.
   Historical signatures must not work after rollout; do not retain the old
   secret as a verification fallback.
3. Build and install the new receiver and `scripts/beanmap-deploy-poller.sh`.
   The new poller requires the verified candidate to equal the latest fetched
   main head and to descend from the deployed commit. Older successful CI runs
   are skipped; wait for current main CI. Unknown deployed history fails closed.
4. Update `beanmap-deploy-webhook.service` to provide a persistent, private,
   service-owned directory. For a systemd service, configure:

   ```ini
   [Service]
   StateDirectory=beanmap-deploy-webhook
   StateDirectoryMode=0700
   Environment=WEBHOOK_LEDGER_DIR=/var/lib/beanmap-deploy-webhook/deliveries
   ```

   Preserve existing sandbox restrictions and ensure this path is writable under
   the service's filesystem policy (for example, a narrow `ReadWritePaths` entry
   if the existing policy requires one). Do not place the ledger in `/run`,
   `/tmp`, an ephemeral container filesystem, or the shared trigger directory.
   The receiver creates the `deliveries` child directory with mode 0700.
5. Activate the updated `.github/workflows/ci-cd.yml` sender in the same window,
   reload systemd and restart the receiver. Re-enable webhook ingress and the
   poller timer only after the new secret and both components are in place.
6. Verify `/healthz`, then run a fresh successful main workflow. Confirm the
   deployed SHA advances to that verified main SHA. A controlled duplicate must
   return 409 without replacing the trigger; missing/expired timestamp must
   return 401; a missing delivery ID returns 400. Test across a receiver restart.

Do not disable timestamp/replay checks to recover a failed rollout. Pause webhook
traffic and repair sender/receiver coordination; the verified timer is the fallback.
A large backward host-clock correction could revive otherwise expired signatures
once ledger retention has elapsed: rotate the secret before resuming in that case.
Do not delete the persistent ledger during ordinary restarts or secret rotation.

The latest-main check uses the head obtained by the deployment's Git fetch. A new
push can occur after that fetch; the forward-only guard still prevents rollback,
and a later verified run advances deployment. Strict serialization with GitHub
branch updates would require a different external deployment coordinator.
