create index analytics_events_matter_idx
  on public.analytics_events (matter_id);

create policy "analytics_events_owner_select"
  on public.analytics_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.matters
      where matters.id = analytics_events.matter_id
        and matters.owner_id = (select auth.uid())
    )
  );
