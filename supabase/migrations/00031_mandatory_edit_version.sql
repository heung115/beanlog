-- Remove the legacy version-omission bypass without changing the session
-- guard, mutation validation, owner, or runtime-only execute grants from 00029.
begin;
do $migration$
declare definition text; body text; patched text;
  old_check constant text := $old$  -- Omission preserves compatibility with clients predating versioned edits.
  if p_bean->>'expected_updated_at' is not null
    and (p_bean->>'expected_updated_at')::timestamptz <> v_current_updated_at then
    raise exception 'record_conflict' using errcode = 'PT409';
  end if;$old$;
  new_check constant text := $new$  -- Every transport must supply the version read by its editor. Validate the
  -- JSON type/format before PostgreSQL's permissive timestamp parser sees it.
  if jsonb_typeof(p_bean->'expected_updated_at') is distinct from 'string'
    or length(p_bean->>'expected_updated_at') > 64
    or p_bean->>'expected_updated_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
    raise exception 'Invalid record version' using errcode = '22023';
  end if;
  begin
    if (p_bean->>'expected_updated_at')::timestamptz <> v_current_updated_at then
      raise exception 'record_conflict' using errcode = 'PT409';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Invalid record version' using errcode = '22023';
  end;$new$;
begin
  select pg_get_functiondef(p.oid), p.prosrc into strict definition, body
    from pg_proc p where p.oid = 'public.update_bean_record(uuid,jsonb,jsonb,jsonb)'::regprocedure;
  if position('perform beanmap_security.require_current_session();' in body) = 0
    or position(old_check in body) = 0 then
    raise exception 'Unexpected update_bean_record body; mandatory version patch refused';
  end if;
  patched := replace(body, old_check, new_check);
  execute replace(definition, body, patched);
end;
$migration$;
alter function public.update_bean_record(uuid,jsonb,jsonb,jsonb) owner to postgres;
commit;
