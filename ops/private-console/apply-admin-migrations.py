#!/usr/bin/env python3
"""Preview, or explicitly apply, administrator migrations 00024+00025 atomically."""

import argparse
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"
TRANSACTION_LINE = re.compile(r"^\s*(begin|commit|rollback)\s*;\s*$", re.IGNORECASE)

PREFLIGHT = r"""\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- This pair is for a database that has 00023 but neither admin migration.
do $admin_preflight$
begin
  if to_regnamespace('beanmap_private') is not null then
    raise exception 'beanmap_private already exists; inspect migration state before retrying';
  end if;
  if exists (select 1 from pg_proc where proname in (
    'beanmap_is_admin', 'beanmap_admin_overview',
    'beanmap_admin_update_catalog', 'beanmap_admin_audit'
  )) then
    raise exception 'An admin function already exists; fresh-pair migration aborted';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.origin_countries'::regclass
      and conname = 'origin_countries_name_ko_check' and contype = 'c' and convalidated
  ) then
    raise exception 'Expected validated catalog constraint is missing';
  end if;
end;
$admin_preflight$;
"""

VERIFY = r"""
-- Every assertion runs before COMMIT. Any error rolls back both migrations.
do $admin_verify$
declare
  f record;
  r record;
  private_oid oid := 'beanmap_private'::regnamespace;
begin
  if (select count(*) from pg_proc where pronamespace = private_oid) <> 4 then
    raise exception 'Expected exactly four private admin functions';
  end if;
  -- regprocedure casts also reject a missing expected signature.
  if exists (
    select 1 from pg_proc where proname in (
      'beanmap_is_admin', 'beanmap_admin_overview',
      'beanmap_admin_update_catalog', 'beanmap_admin_audit'
    ) and oid not in (
      'beanmap_private.beanmap_is_admin()'::regprocedure,
      'beanmap_private.beanmap_admin_overview()'::regprocedure,
      'beanmap_private.beanmap_admin_update_catalog(text,bigint,text,text,text)'::regprocedure,
      'beanmap_private.beanmap_admin_audit()'::regprocedure
    )
  ) then
    raise exception 'Unexpected admin wrapper, schema, or overload remains';
  end if;
  if not has_schema_privilege('authenticated', private_oid, 'USAGE')
    or has_schema_privilege('authenticated', private_oid, 'CREATE')
    or has_schema_privilege('anon', private_oid, 'USAGE,CREATE')
    or has_schema_privilege('service_role', private_oid, 'USAGE,CREATE')
    or exists (
      select 1 from pg_namespace n,
        lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
      where n.oid = private_oid and acl.grantee = 0
    ) then
    raise exception 'Private schema grants are unsafe';
  end if;
  for f in select * from pg_proc where pronamespace = private_oid loop
    if not f.prosecdef or not coalesce(f.proconfig @> array['search_path=""'], false)
      or not has_function_privilege('authenticated', f.oid, 'EXECUTE')
      or has_function_privilege('anon', f.oid, 'EXECUTE')
      or has_function_privilege('service_role', f.oid, 'EXECUTE')
      or exists (
        select 1 from aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      ) then
      raise exception 'Unsafe admin function privileges or configuration: %', f.proname;
    end if;
  end loop;
  if to_regclass('beanmap_private.admin_users') is null
    or to_regclass('beanmap_private.admin_catalog_audit') is null then
    raise exception 'Private admin tables are incomplete';
  end if;
  for r in select * from pg_class where relnamespace = private_oid and relkind in ('r','p','S') loop
    if r.relkind in ('r','p') then
      if not r.relrowsecurity
        or has_table_privilege('authenticated', r.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_table_privilege('anon', r.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_table_privilege('service_role', r.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Private table RLS or grants are unsafe: %', r.relname;
      end if;
    elsif has_sequence_privilege('authenticated', r.oid, 'SELECT,UPDATE,USAGE')
      or has_sequence_privilege('anon', r.oid, 'SELECT,UPDATE,USAGE')
      or has_sequence_privilege('service_role', r.oid, 'SELECT,UPDATE,USAGE') then
      raise exception 'Private sequence grants are unsafe: %', r.relname;
    end if;
  end loop;
  if exists(select 1 from beanmap_private.admin_users)
    or exists(select 1 from beanmap_private.admin_catalog_audit) then
    raise exception 'Fresh migration unexpectedly populated an admin table';
  end if;
end;
$admin_verify$;

-- Exercise the real authenticated role with a synthetic, unlisted identity.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
do $admin_verify_membership$
begin
  if beanmap_private.beanmap_is_admin() then
    raise exception 'An unlisted identity unexpectedly has administrator membership';
  end if;
  begin
    perform * from beanmap_private.beanmap_admin_overview();
    raise exception 'Unlisted overview access unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from beanmap_private.beanmap_admin_audit();
    raise exception 'Unlisted audit access unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform beanmap_private.beanmap_admin_update_catalog('country', 1, 'test', null, 'test');
    raise exception 'Unlisted catalog update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$admin_verify_membership$;
reset role;
commit;
"""


def migration_body(sql: str, *, wrapped: bool) -> str:
    """Remove only the known migration's outer transaction, never function bodies."""
    lines = sql.splitlines(keepends=True)
    boundaries = [i for i, line in enumerate(lines) if TRANSACTION_LINE.fullmatch(line)]
    if not wrapped:
        if boundaries:
            raise ValueError("00024 unexpectedly contains transaction control")
        return sql
    commands = [
        i for i, line in enumerate(lines)
        if line.strip() and not line.lstrip().startswith("--")
    ]
    if (
        len(boundaries) != 2
        or boundaries != [commands[0], commands[-1]]
        or lines[boundaries[0]].strip().lower() != "begin;"
        or lines[boundaries[1]].strip().lower() != "commit;"
    ):
        raise ValueError("00025 no longer has the expected single outer BEGIN/COMMIT")
    return "".join(line for i, line in enumerate(lines) if i not in boundaries)


def build_sql(migrations: Path = MIGRATIONS) -> str:
    old = (migrations / "00024_admin_console.sql").read_text(encoding="utf-8")
    new = (migrations / "00025_private_admin_boundary.sql").read_text(encoding="utf-8")
    return "\n".join((
        PREFLIGHT,
        migration_body(old, wrapped=False),
        migration_body(new, wrapped=True),
        VERIFY,
    ))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true",
        help="apply to ssh alias oracle / container supabase-db (default: print SQL only)",
    )
    args = parser.parse_args(argv)
    try:
        sql = build_sql()
    except (OSError, ValueError) as error:
        parser.error(str(error))
    if not args.apply:
        sys.stdout.write(sql)
        return 0
    result = subprocess.run(
        ["ssh", "oracle", "sudo docker exec -i supabase-db "
         "psql -X -U postgres -d postgres -v ON_ERROR_STOP=1"],
        input=sql, text=True, check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
