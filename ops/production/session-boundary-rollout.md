# Coordinated session-boundary release

This one-time operator procedure keeps SQL migrations 00029–00033 and the API
that supplies their current-session claims in the same release window. The normal
app deployer does not apply migrations; it must not deploy this release first.
The existing app serves throughout the image build. SQL commit and app replacement
can produce a brief retry window. Do not roll back to the old API after SQL commit.

## Preparation

Review the exact release and all five migrations before proceeding. Run:

```sh
python3 ops/production/test_session_boundary_rollout.py
```

The script only executes with root and `--execute`. It performs these steps:

1. Acquire `deploy.lock` followed by `deploy-execution.lock`, matching the existing
   poller/wrapper lock order. Leave their services and timer enabled.
2. Wait for a root-owned mode `0600` `release.json` in the private state directory.
3. Verify that the supplied CI run is the repository's `main` push workflow and its
   `Verify` job succeeded. Fetch main and require exact latest-main identity and
   forward history from the deployed commit. Repeat after build and backup.
4. Compare complete normalized Compose configurations, allowing only the API Auth
   URL and new API-only secret mount. Preserve existing web trusted IP, private
   networks, resource bounds, all other environment values and secrets.
5. Preserve existing source, Compose files and both image IDs, with backup image
   tags. Create a 32-byte random identity secret encoded as 64 hex characters,
   owned by `1001:1001`, mode `0400`; never log its value. Reuse an existing secret
   only when its metadata matches. Build new app images while old containers serve.
6. Save a private full database dump and roles backup, and check the dump inventory.
   This inventory check is not a full restore rehearsal. Keep these backups private;
   they contain application/authentication data and must not be committed.
7. Apply five migrations, the private checksum ledger and the function-ACL checks
   in one transaction, connecting as `supabase_admin`; migrations assign ownership
   of security functions/tables to `postgres`. No historical migration is replayed.
8. Replace the app without rebuilding, require healthy containers and exact built
   image IDs, check the web deployment label and native image-runtime versions,
   verify ACLs again and probe the loopback login page. Write `deployed-sha` only
   after every check succeeds.

Use a new root-owned mode `0700` directory under
`/srv/beanlog/security-rollout-20260909/` for this release. Stage the reviewed script
there as a root-owned mode `0700` file before starting. Keep its release request,
status, operator log, dumps and source snapshots in that directory.

## Acquire the gate before merging

Start the staged script as a transient system service so an SSH disconnect does
not release the locks. For example, with the reviewed artifact staged in the
private `session-boundary` directory:

```sh
sudo systemd-run --unit=beanmap-session-rollout --property=Type=exec \
  --property=Restart=no /usr/bin/python3 \
  /srv/beanlog/security-rollout-20260909/session-boundary/session-boundary-rollout.py \
  --execute \
  --state-dir /srv/beanlog/security-rollout-20260909/session-boundary
sudo cat /srv/beanlog/security-rollout-20260909/session-boundary/status.json
```

Require `locked-waiting-for-release` before merging. A running unit alone does not
prove both locks were acquired. Merge only the approved PR head after its required
checks pass. Then wait for the exact resulting main commit's CI `Verify` job to
succeed. Supply its full 40-character SHA and numeric workflow run ID in a private
file using a root session and atomic rename:

```json
{"sha":"FULL_VERIFIED_MAIN_SHA","run_id":123456789}
```

The placeholder above is deliberately invalid and cannot trigger a release. The
script validates GitHub evidence independently instead of trusting the file alone.
Track only `status.json` for general progress; read `operator.log` locally as root
when diagnosing a failure, and redact any private information before sharing it.

## Failure and resumption

The script keeps both locks on every failure. `failed-locks-held` records whether
SQL may have been applied. A connection error during COMMIT counts as uncertain;
do not infer rollback from a failed client command. Confirm the checksum ledger.
Never kill this process or stop the unit while the newly merged main remains
eligible for ordinary deployment without an equivalent operator-owned gate.

Fix the cause, then create a private empty `resume` file in the state directory.
The same process re-verifies CI/main identity and starts another preserved attempt.
If all five ledger checksums match it verifies ACLs without replaying SQL. A
partial or changed ledger is rejected and requires explicit investigation. No
automatic SQL rollback, privilege widening, data restoration or old-API deployment
is implemented. Keep the first backup attempt as the pre-migration recovery source.

Before SQL starts, an operator can abandon the attempt only after arranging an
independent deployment gate and reviewing source/image/Compose state. After SQL may
have committed, fix forward while preserving the new boundary. The process is not
a general-purpose automatic migration runner.

## Complete the release

After `complete`, confirm the actual web release identity and both app images are
healthy. The existing poller should see the same `deployed-sha` and perform no
replacement. Apply the separately reviewed Auth gateway budgets/template candidate
only after SQL and the new API/web are healthy. Run the scoped public/session,
private RPC, account-deletion and source-privacy verification. Record actual checks
and any limitations in the private audit, keeping public source documentation free
of private account data, runtime secrets and production audit payloads.
