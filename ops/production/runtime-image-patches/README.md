# Runtime image patch rollout

`rollout.py` replaces one reviewed service image per invocation. It does not build,
pull, push, delete images, run migrations, restore a database, or change a cloud
backup policy. The coordinator must approve the candidate image IDs and the
production window before using `--apply`.

## Reviewed inputs

Store an operator-reviewed manifest outside Git in a root-owned `0700` directory,
with the manifest itself `0600`. Its exact format is:

```json
{
  "format": 1,
  "images": {
    "db": {"old": "sha256:<64 lowercase hex>", "new": "sha256:<64 lowercase hex>"},
    "rest": {"old": "sha256:<64 lowercase hex>", "new": "sha256:<64 lowercase hex>"},
    "meta": {"old": "sha256:<64 lowercase hex>", "new": "sha256:<64 lowercase hex>"},
    "studio": {"old": "sha256:<64 lowercase hex>", "new": "sha256:<64 lowercase hex>"}
  }
}
```

Replace the placeholders with inspected immutable IDs; tags and identical old/new
IDs are rejected. Include only approved stages. All images must already exist on
the host as Linux ARM64 images. Record the manifest and tool checksums in the
operator's private release evidence. This patch workflow requires both DB images
to contain PostgreSQL 17.11; a server-version upgrade needs a separate rehearsal.

The tool checks the live container name, project, service, working directory and
complete ordered Compose file list. Supabase uses its four existing Compose files;
the private console uses its existing `compose.yml`. A different stack fails
closed. Both rendered configurations remain in memory. Only the selected service's
`image` may differ, including across networks, secrets, environment, mounts,
healthchecks, privileges and all other services. Original source files are saved
root-private before a replacement. Input changes during preparation are rejected.

The scalar editor deliberately accepts only the host's plain block service
mapping. It preserves other source bytes and uses Compose's normalized rendering
as the semantic check. Unsupported YAML spelling is an error, not a reason to
rewrite or simplify the stack.

## Stage execution

After candidate tests and coordinator GO, invoke each approved stage separately:

```sh
sudo python3 /ROOT/REVIEWED/rollout.py \
  --manifest /ROOT/PRIVATE/images.json \
  --stage db \
  --state-directory /srv/beanlog/security-runtime-images-RELEASE/db \
  --apply
```

Use `rest`, `meta` and `studio` with their own **new** state directories for the
other stages. A prior state directory is never reused. Each invocation takes
`deploy.lock` and then `deploy-execution.lock`, both exclusively and nonblocking.
Do not wrap it in another process that already owns these locks. No other image,
configuration, migration or deployment work may be scheduled during these stages.

The command sequence for each stage is:

1. Inspect the approved live and locally available image IDs; require a healthy
   source container and unchanged configured image. Render the existing complete
   stack and the candidate image-only overlay, and compare their full objects.
2. For DB only, verify the data/config mount sources, PostgreSQL version and
   available space. Write a fresh `pg_dumpall` into the private stage directory.
   Stop DB with a 60-second timeout, require `pg_controldata` to report a clean
   shutdown, and archive data and DB configuration with numeric ownership,
   extended attributes and ACLs. Record checksums before replacement.
3. Atomically update the selected source image scalar; retain file ownership and
   mode. Render again and check that only this image changed. Execute
   `docker compose ... up -d --no-deps --pull never --timeout 60 SERVICE`.
4. Require the exact new image and a healthy container within 120 seconds; verify
   unchanged DB version for the DB stage. Record
   `healthy-awaiting-independent-validation` and release the locks.
5. Run the coordinator's independent service, permission and application checks
   before approving the next stage. Container health alone does not mark the
   release validated. Save those results separately beside the stage evidence.

`state.json` records progress and image IDs without environment values or command
output. SQL, raw Compose source and physical backups are sensitive, root-private
artifacts. They must not be published or printed.

## Failure and image rollback

Before DB stop, the tool writes and validates a private rollback overlay containing
the **immutable old ID**. On an error after stop or image replacement, this existing
overlay recreates only the selected service. If the source was never replaced,
recovery does not attempt another source write. If it was replaced, restoring its
old image is attempted, but a source write failure does not prevent the pinned
rollback from starting. DB receives another graceful stop before image rollback. The tool never extracts a backup into production, removes a data
volume, or overwrites newer data. Source recovery files remain available for a
separately reviewed recovery if the current data itself is damaged.

Successful automatic rollback records `failed-old-image-restored` and still exits
with failure. `rollback_override_active` identifies its extra Compose file;
`source_repair_required` reports a failed persistent source repair. Review and
reconcile that source/Compose file chain before another rollout. A failing write
removes only the temporary file that this invocation created, preserving a
pre-existing temporary file. A rollback error records `manual-recovery-required`. The operator
must keep the release stopped and investigate; locks are released when the process
exits. Do not retry into the same state directory or use an older database snapshot
to make an unhealthy service appear healthy. A killed host/process also requires
review of its last state; this tool is not an unattended deployment supervisor.

## Backup capacity and image deltas

The current off-host tool enforces a 4,000,000,000-byte pool cap. A further complete
image baseline must not be uploaded when it exceeds that cap. Do not raise the cap
or delete an existing baseline to make room. Small daily DB/roles/config snapshots
can continue only when the usual private-bucket and actual-capacity checks pass.

Image layers may be shared with an existing verified baseline, but `docker image
save` includes those layers again. A proposed delta backup must therefore first
inventory the OCI archive's content-addressed blobs and exact manifest/config/index
files. A safe delta would store only missing blobs plus the new archive metadata,
and identify every required base object by immutable generation and checksum.
Recovery must reconstruct a complete archive from independently downloaded and
verified base/delta objects, load the exact reviewed image ID, then pass isolated
DB/service recovery checks. Missing base content, inconsistent metadata and digest
mismatch must fail closed.

Delta support is an investigation at this point: the existing backup manifest and
restore tools do not implement this dependency contract. A small estimated delta
is not proof that it is recoverable. Do not upload a custom partial archive as if
it were a complete baseline. Keep the old images and private local recovery
artifacts until a separately reviewed off-host image strategy passes recovery.

## Local tests

```sh
python3 -m unittest discover -s ops/production/runtime-image-patches -p 'test_rollout.py'
```

Tests reject mutable image references and changed stack identity, check image-only
semantics, reject concurrent source edits, require clean DB shutdown before a
physical backup, and exercise failed-candidate rollback without database restore
or unrelated service replacement. They do not execute a production rollout.
