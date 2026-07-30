-- Keep a bean and all of its dependent rows in one transaction. These
-- functions are SECURITY INVOKER: RLS and the caller's grants remain active.

create or replace function public.create_bean_record(
  p_bean jsonb,
  p_tags jsonb default '[]'::jsonb,
  p_components jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_type text := p_bean->>'bean_type';
  v_component_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_bean) <> 'object'
    or jsonb_typeof(p_tags) <> 'array'
    or jsonb_typeof(p_components) <> 'array' then
    raise exception 'Invalid payload' using errcode = '22023';
  end if;

  select coalesce(sum(x.percentage), 0)
    into v_component_total
  from jsonb_to_recordset(p_components) as x(percentage numeric);

  if v_type = 'blend' and (jsonb_array_length(p_components) = 0 or abs(v_component_total - 100) > 0.01) then
    raise exception 'Blend percentages must total 100' using errcode = '23514';
  elsif v_type = 'single_origin' and jsonb_array_length(p_components) > 0 then
    raise exception 'Single origins cannot contain blend components' using errcode = '23514';
  end if;

  insert into public.beans (
    user_id, name, roastery, bean_type,
    origin_country, origin_country_id, origin_region, origin_region_id,
    origin_subregions, origin_lat, origin_lng, farm_producer, origin_entity_id,
    varietal, process_method, process_detail, altitude_m, harvest_year,
    roast_level, roast_date, consumed_at, place_type, cafe_name,
    cafe_location, menu_name, overall_score, note,
    score_aroma, score_acidity, score_body, score_sweetness,
    score_aftertaste, score_balance, purchase_source, price, weight_g, purchased_at
  ) values (
    auth.uid(), p_bean->>'name', p_bean->>'roastery', v_type,
    nullif(p_bean->>'origin_country', ''), (p_bean->>'origin_country_id')::bigint,
    nullif(p_bean->>'origin_region', ''), (p_bean->>'origin_region_id')::bigint,
    array(select jsonb_array_elements_text(coalesce(p_bean->'origin_subregions', '[]'::jsonb))),
    (p_bean->>'origin_lat')::numeric, (p_bean->>'origin_lng')::numeric,
    nullif(p_bean->>'farm_producer', ''), (p_bean->>'origin_entity_id')::bigint,
    nullif(p_bean->>'varietal', ''), p_bean->>'process_method',
    nullif(p_bean->>'process_detail', ''), (p_bean->>'altitude_m')::integer,
    (p_bean->>'harvest_year')::integer, p_bean->>'roast_level',
    (p_bean->>'roast_date')::date, (p_bean->>'consumed_at')::timestamptz,
    p_bean->>'place_type', nullif(p_bean->>'cafe_name', ''),
    nullif(p_bean->>'cafe_location', ''), nullif(p_bean->>'menu_name', ''),
    (p_bean->>'overall_score')::numeric, p_bean->>'note',
    (p_bean->>'score_aroma')::smallint, (p_bean->>'score_acidity')::smallint,
    (p_bean->>'score_body')::smallint, (p_bean->>'score_sweetness')::smallint,
    (p_bean->>'score_aftertaste')::smallint, (p_bean->>'score_balance')::smallint,
    nullif(p_bean->>'purchase_source', ''), (p_bean->>'price')::integer,
    (p_bean->>'weight_g')::integer, (p_bean->>'purchased_at')::date
  ) returning id into v_id;

  insert into public.tasting_tags (bean_id, user_id, tag, category)
  select v_id, auth.uid(), x.tag, x.category
  from jsonb_to_recordset(p_tags) as x(tag text, category text);

  insert into public.blend_components (
    bean_id, user_id, origin_country, origin_region, origin_subregions,
    farm_producer, varietal, process_method, process_detail, percentage, sort_order
  )
  select v_id, auth.uid(), x.origin_country, x.origin_region,
    coalesce(x.origin_subregions, '{}'::text[]), x.farm_producer, x.varietal,
    x.process_method, x.process_detail, x.percentage, x.sort_order
  from jsonb_to_recordset(p_components) as x(
    origin_country text, origin_region text, origin_subregions text[],
    farm_producer text, varietal text, process_method text,
    process_detail text, percentage numeric, sort_order integer
  );

  return v_id;
end;
$$;

create or replace function public.update_bean_record(
  p_id uuid,
  p_bean jsonb,
  p_tags jsonb default '[]'::jsonb,
  p_components jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type text := p_bean->>'bean_type';
  v_component_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_bean) <> 'object'
    or jsonb_typeof(p_tags) <> 'array'
    or jsonb_typeof(p_components) <> 'array' then
    raise exception 'Invalid payload' using errcode = '22023';
  end if;

  select coalesce(sum(x.percentage), 0)
    into v_component_total
  from jsonb_to_recordset(p_components) as x(percentage numeric);

  if v_type = 'blend' and (jsonb_array_length(p_components) = 0 or abs(v_component_total - 100) > 0.01) then
    raise exception 'Blend percentages must total 100' using errcode = '23514';
  elsif v_type = 'single_origin' and jsonb_array_length(p_components) > 0 then
    raise exception 'Single origins cannot contain blend components' using errcode = '23514';
  end if;

  update public.beans set
    name = p_bean->>'name', roastery = p_bean->>'roastery', bean_type = v_type,
    origin_country = nullif(p_bean->>'origin_country', ''),
    origin_country_id = (p_bean->>'origin_country_id')::bigint,
    origin_region = nullif(p_bean->>'origin_region', ''),
    origin_region_id = (p_bean->>'origin_region_id')::bigint,
    origin_subregions = array(select jsonb_array_elements_text(coalesce(p_bean->'origin_subregions', '[]'::jsonb))),
    origin_lat = (p_bean->>'origin_lat')::numeric,
    origin_lng = (p_bean->>'origin_lng')::numeric,
    farm_producer = nullif(p_bean->>'farm_producer', ''),
    origin_entity_id = (p_bean->>'origin_entity_id')::bigint,
    varietal = nullif(p_bean->>'varietal', ''),
    process_method = p_bean->>'process_method',
    process_detail = nullif(p_bean->>'process_detail', ''),
    altitude_m = (p_bean->>'altitude_m')::integer,
    harvest_year = (p_bean->>'harvest_year')::integer,
    roast_level = p_bean->>'roast_level', roast_date = (p_bean->>'roast_date')::date,
    consumed_at = (p_bean->>'consumed_at')::timestamptz,
    place_type = p_bean->>'place_type', cafe_name = nullif(p_bean->>'cafe_name', ''),
    cafe_location = nullif(p_bean->>'cafe_location', ''), menu_name = nullif(p_bean->>'menu_name', ''),
    overall_score = (p_bean->>'overall_score')::numeric, note = p_bean->>'note',
    score_aroma = (p_bean->>'score_aroma')::smallint,
    score_acidity = (p_bean->>'score_acidity')::smallint,
    score_body = (p_bean->>'score_body')::smallint,
    score_sweetness = (p_bean->>'score_sweetness')::smallint,
    score_aftertaste = (p_bean->>'score_aftertaste')::smallint,
    score_balance = (p_bean->>'score_balance')::smallint,
    purchase_source = nullif(p_bean->>'purchase_source', ''),
    price = (p_bean->>'price')::integer, weight_g = (p_bean->>'weight_g')::integer,
    purchased_at = (p_bean->>'purchased_at')::date, updated_at = now()
  where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'Bean not found' using errcode = 'P0002';
  end if;

  delete from public.tasting_tags where bean_id = p_id and user_id = auth.uid();
  delete from public.blend_components where bean_id = p_id and user_id = auth.uid();

  insert into public.tasting_tags (bean_id, user_id, tag, category)
  select p_id, auth.uid(), x.tag, x.category
  from jsonb_to_recordset(p_tags) as x(tag text, category text);

  insert into public.blend_components (
    bean_id, user_id, origin_country, origin_region, origin_subregions,
    farm_producer, varietal, process_method, process_detail, percentage, sort_order
  )
  select p_id, auth.uid(), x.origin_country, x.origin_region,
    coalesce(x.origin_subregions, '{}'::text[]), x.farm_producer, x.varietal,
    x.process_method, x.process_detail, x.percentage, x.sort_order
  from jsonb_to_recordset(p_components) as x(
    origin_country text, origin_region text, origin_subregions text[],
    farm_producer text, varietal text, process_method text,
    process_detail text, percentage numeric, sort_order integer
  );

  return p_id;
end;
$$;

revoke all on function public.create_bean_record(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.update_bean_record(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_bean_record(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_bean_record(uuid, jsonb, jsonb, jsonb) to authenticated;
