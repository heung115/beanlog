import { createHash } from "node:crypto";

const privileged = new Set([
  "00028_function_execution_allowlist.sql",
  "00029_current_session_boundary.sql",
  "00030_account_deletion_proof.sql",
  "00031_mandatory_edit_version.sql",
  "00032_origin_contact_minimization.sql",
]);
export function splitStagingMigrations(names) {
  const ordered = [...names].filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  const deferred = ordered.filter(name => name >= "00028_");
  if (deferred.some(name => !privileged.has(name))) {
    throw new Error("Review new migrations before extending privileged local staging bootstrap");
  }
  return { bootstrap: ordered.filter(name => !privileged.has(name)), privileged: deferred };
}

const quote = value => "'" + value.replaceAll("'", "''") + "'";
export function privilegedStagingMigration(name, source) {
  if (!privileged.has(name)) throw new Error("Unreviewed privileged staging migration");
  const start = source.match(/^\s*(?:(?:--[^\n]*\n)\s*)*begin\s*;/i);
  if (!start || !/commit\s*;\s*$/i.test(source)) throw new Error("Expected one explicit migration transaction");
  const body = source.slice(start[0].length).replace(/commit\s*;\s*$/i, "");
  const sha = createHash("sha256").update(source).digest("hex");
  const [version, ...description] = name.replace(/\.sql$/, "").split("_");
  return `BEGIN;
SELECT pg_advisory_xact_lock(1937006964, 111);
CREATE TABLE IF NOT EXISTS supabase_migrations.beanmap_local_privileged_migrations (
  version text PRIMARY KEY, sha256 text NOT NULL
);
REVOKE ALL ON TABLE supabase_migrations.beanmap_local_privileged_migrations FROM public, anon, authenticated, service_role;
DO $beanmap_staging_migration$
DECLARE stored_hash text; recorded boolean;
BEGIN
  SELECT sha256 INTO stored_hash FROM supabase_migrations.beanmap_local_privileged_migrations WHERE version = ${quote(version)};
  SELECT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = ${quote(version)}) INTO recorded;
  IF stored_hash IS NOT NULL THEN
    IF stored_hash <> ${quote(sha)} OR NOT recorded THEN
      RAISE EXCEPTION 'Privileged staging migration history mismatch: ${version}';
    END IF;
    RETURN;
  END IF;
  IF recorded THEN RAISE EXCEPTION 'Unverified privileged staging migration history: ${version}'; END IF;
  EXECUTE ${quote(body)};
  INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
    VALUES (${quote(version)}, ${quote(description.join("_"))}, ARRAY[${quote(body)}]);
  INSERT INTO supabase_migrations.beanmap_local_privileged_migrations VALUES (${quote(version)}, ${quote(sha)});
END;
$beanmap_staging_migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
`;
}
