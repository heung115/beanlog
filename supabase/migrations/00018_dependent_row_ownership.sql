-- A child row must belong to both the caller and a bean owned by the caller.
-- Checking only child.user_id allowed a caller who learned another bean UUID to
-- attach their own tag/component to that foreign parent.

drop policy if exists "tags_insert_own" on public.tasting_tags;
create policy "tags_insert_own"
  on public.tasting_tags for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.beans
      where beans.id = tasting_tags.bean_id
        and beans.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own blend components" on public.blend_components;
create policy "Users can insert own blend components"
  on public.blend_components for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.beans
      where beans.id = blend_components.bean_id
        and beans.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own blend components" on public.blend_components;
create policy "Users can update own blend components"
  on public.blend_components for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.beans
      where beans.id = blend_components.bean_id
        and beans.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.beans
      where beans.id = blend_components.bean_id
        and beans.user_id = auth.uid()
    )
  );
