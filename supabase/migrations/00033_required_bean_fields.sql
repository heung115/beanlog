-- Keep the internal mutation boundary consistent with required form fields.
-- Public mutation grants stay revoked; all runtime writes still validate here.
begin;

create function beanmap_security.normalize_required_bean_fields(p_bean jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  field_name text;
  field_value text;
  max_length integer;
  -- ECMAScript String.trim whitespace, also used by the form schema.
  whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if jsonb_typeof(p_bean) is distinct from 'object' then
    raise exception 'Invalid bean object' using errcode = '22023';
  end if;
  foreach field_name in array array['name', 'roastery', 'note'] loop
    if jsonb_typeof(p_bean->field_name) is distinct from 'string' then
      raise exception 'Invalid required field: %', field_name using errcode = '22023';
    end if;
    field_value := btrim(p_bean->>field_name, whitespace);
    max_length := case when field_name = 'note' then 2000 else 200 end;
    if char_length(field_value) not between 1 and max_length then
      raise exception 'Invalid required field: %', field_name using errcode = '22023';
    end if;
    p_bean := jsonb_set(p_bean, array[field_name], to_jsonb(field_value));
  end loop;

  foreach field_name in array array['bean_type', 'process_method', 'roast_level', 'place_type'] loop
    if jsonb_typeof(p_bean->field_name) is distinct from 'string' then
      raise exception 'Invalid required field: %', field_name using errcode = '22023';
    end if;
    field_value := p_bean->>field_name;
    if not (case field_name
      when 'bean_type' then field_value = any(array['single_origin', 'blend'])
      when 'process_method' then field_value = any(array['washed', 'natural', 'honey', 'anaerobic', 'carbonic', 'decaf', 'other'])
      when 'roast_level' then field_value = any(array['light', 'medium', 'dark'])
      when 'place_type' then field_value = any(array['cafe', 'home'])
    end) then
      raise exception 'Invalid required field: %', field_name using errcode = '22023';
    end if;
  end loop;

  if p_bean->>'bean_type' = 'single_origin' then
    if jsonb_typeof(p_bean->'origin_country') is distinct from 'string' then
      raise exception 'Invalid single-origin country' using errcode = '22023';
    end if;
    field_value := btrim(p_bean->>'origin_country', whitespace);
    if char_length(field_value) not between 1 and 100 then
      raise exception 'Invalid single-origin country' using errcode = '22023';
    end if;
    p_bean := jsonb_set(p_bean, '{origin_country}', to_jsonb(field_value));
  end if;

  if jsonb_typeof(p_bean->'overall_score') is distinct from 'number' then
    raise exception 'Invalid overall score' using errcode = '22023';
  end if;
  if (p_bean->>'overall_score')::numeric not between 1 and 10 then
    raise exception 'Invalid overall score' using errcode = '22023';
  end if;

  if jsonb_typeof(p_bean->'consumed_at') is distinct from 'string'
    or length(p_bean->>'consumed_at') > 64
    or p_bean->>'consumed_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
    raise exception 'Invalid consumption time' using errcode = '22023';
  end if;
  begin
    perform (p_bean->>'consumed_at')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Invalid consumption time' using errcode = '22023';
  end;
  return p_bean;
end;
$$;
alter function beanmap_security.normalize_required_bean_fields(jsonb) owner to postgres;
revoke all on function beanmap_security.normalize_required_bean_fields(jsonb)
  from public, anon, authenticated, service_role, beanmap_api_runtime;

-- Patch only the known bounded, session-checked definitions. CREATE OR REPLACE
-- preserves their signatures, ACLs, SECURITY DEFINER and edit-version checks.
do $migration$
declare
  signature text;
  definition text;
  body text;
  marker constant text := '  perform public.assert_bean_mutation_payload(p_bean, p_tags, p_components);';
begin
  foreach signature in array array[
    'public.create_bean_record(jsonb,jsonb,jsonb)',
    'public.update_bean_record(uuid,jsonb,jsonb,jsonb)'
  ] loop
    select pg_get_functiondef(p.oid), p.prosrc into strict definition, body
      from pg_proc p where p.oid = signature::regprocedure;
    if position('perform beanmap_security.require_current_session();' in body) = 0
      or (length(body) - length(replace(body, marker, ''))) <> length(marker) then
      raise exception 'Unexpected mutation function body; required-field patch refused';
    end if;
    execute replace(definition, body, replace(body, marker, marker || E'\n  p_bean := beanmap_security.normalize_required_bean_fields(p_bean);'));
  end loop;
end;
$migration$;

-- Enforce invariants for every new write without fabricating missing historic
-- content or deleting user data. NOT VALID exempts only pre-existing rows from
-- the initial scan; inserts and updates are checked immediately.
alter table public.beans
  add constraint beans_required_text_nonblank check (
    char_length(btrim(name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0
    and char_length(btrim(roastery, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0
    and char_length(btrim(note, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0
  ) not valid,
  add constraint beans_single_origin_country_required check (
    bean_type <> 'single_origin' or (
      origin_country is not null
      and char_length(btrim(origin_country, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0
    )
  ) not valid;

commit;
