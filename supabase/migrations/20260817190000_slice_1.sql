create extension if not exists pgcrypto;

create table public.student_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  beta_notice_version text,
  beta_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'matter_opening'
    check (status in ('matter_opening', 'stopped', 'opening_confirmed')),
  workflow_version text not null,
  current_stage text not null default 'matter_opening',
  current_step text not null default 'MO01_OUTCOMES',
  progress integer not null default 12 check (progress between 0 and 100),
  stop_state jsonb,
  opening_confirmed_at timestamptz,
  retention_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create table public.matter_openings (
  matter_id uuid primary key references public.matters(id) on delete cascade,
  owner_id uuid not null,
  record jsonb not null,
  workflow_state jsonb not null,
  revision integer not null default 0,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matter_opening_revisions (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  owner_id uuid not null,
  revision integer not null,
  record jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (matter_id, revision)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  owner_id uuid not null,
  turn_key uuid not null,
  role text not null check (role in ('student', 'assistant')),
  step text not null,
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now(),
  unique (matter_id, turn_key, role)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  matter_id uuid references public.matters(id) on delete cascade,
  owner_id uuid not null,
  event_name text not null,
  workflow_version text not null,
  step text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (not (metadata ?| array['answer', 'content', 'email', 'phone', 'transcript']))
);

create index matters_owner_updated_idx on public.matters (owner_id, updated_at desc);
create index messages_matter_created_idx on public.messages (matter_id, created_at);
create index revisions_matter_created_idx
  on public.matter_opening_revisions (matter_id, created_at desc);

alter table public.student_profiles enable row level security;
alter table public.matters enable row level security;
alter table public.matter_openings enable row level security;
alter table public.matter_opening_revisions enable row level security;
alter table public.messages enable row level security;
alter table public.analytics_events enable row level security;

create policy student_profiles_select_own
  on public.student_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy student_profiles_insert_own
  on public.student_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy student_profiles_update_own
  on public.student_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy matters_select_own
  on public.matters for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy matter_openings_select_own
  on public.matter_openings for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy matter_opening_revisions_select_own
  on public.matter_opening_revisions for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy messages_select_own
  on public.messages for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.student_profiles from anon;
revoke all on public.matters from anon;
revoke all on public.matter_openings from anon;
revoke all on public.matter_opening_revisions from anon;
revoke all on public.messages from anon;
revoke all on public.analytics_events from anon, authenticated;

grant select, insert, update on public.student_profiles to authenticated;
grant select on public.matters to authenticated;
grant select on public.matter_openings to authenticated;
grant select on public.matter_opening_revisions to authenticated;
grant select on public.messages to authenticated;

create or replace function public.create_slice1_matter(
  p_owner_id uuid,
  p_name text,
  p_workflow_version text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_now timestamptz := now();
begin
  select id into v_id from public.matters where owner_id = p_owner_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.matters (
    owner_id, name, workflow_version, current_stage, current_step, progress
  ) values (
    p_owner_id, p_name, p_workflow_version, 'matter_opening', 'MO01_OUTCOMES', 12
  ) returning id into v_id;

  insert into public.matter_openings (matter_id, owner_id, record, workflow_state)
  values (
    v_id,
    p_owner_id,
    jsonb_build_object(
      'matter_id', v_id,
      'opened_on', v_now,
      'matter_status', 'OPEN',
      'matter_classification', 'NEW_PLAN',
      'desired_outcomes', '[]'::jsonb,
      'top_three_priorities', '[]'::jsonb,
      'principal_definition_of_success', 'unknown',
      'priority_details', '[]'::jsonb,
      'people_and_interests_snapshot', 'unknown',
      'people_circumstance_flags', '[]'::jsonb,
      'current_plan_snapshot', 'unknown',
      'current_plan_status', 'no_existing_plan',
      'changes_since_current_plan', '[]'::jsonb,
      'timing_event_or_deadline', jsonb_build_object(
        'reason', 'unknown', 'event', 'unknown', 'date', 'unknown', 'importance', 'unknown'
      ),
      'geographic_and_complexity_flags', '[]'::jsonb,
      'professional_and_family_contacts', '[]'::jsonb,
      'missing_contacts', '[]'::jsonb,
      'other_participants', '[]'::jsonb,
      'house_in_order_concern', 'unknown',
      'selected_discovery_path', 'unknown',
      'single_next_action', 'unknown',
      'principal_confirmed', 'no',
      'confirmation_date', 'unknown'
    ),
    jsonb_build_object(
      'step', 'MO01_OUTCOMES',
      'goal_followup_queue', '[]'::jsonb,
      'active_goal_followup', null,
      'accepted_turns', 0,
      'stop', null
    )
  );

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step
  ) values (v_id, p_owner_id, 'matter_started', p_workflow_version, 'MO01_OUTCOMES');

  return v_id;
end;
$$;

create or replace function public.apply_matter_opening_turn(
  p_matter_id uuid,
  p_owner_id uuid,
  p_turn_key uuid,
  p_expected_step text,
  p_student_message text,
  p_assistant_message text,
  p_record jsonb,
  p_workflow_state jsonb,
  p_progress integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_step text;
  v_revision integer;
begin
  if exists (
    select 1 from public.messages
    where matter_id = p_matter_id and turn_key = p_turn_key and role = 'student'
  ) then
    return true;
  end if;

  select owner_id, current_step
    into v_owner, v_step
    from public.matters
    where id = p_matter_id
    for update;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if v_step <> p_expected_step then
    raise exception 'stale workflow state';
  end if;
  if coalesce(p_workflow_state->>'step', '') in ('CONFIRMED') then
    raise exception 'confirmation requires the confirmation function';
  end if;

  if p_expected_step = 'MO08_CONFIRM' then
    select revision + 1 into v_revision
      from public.matter_openings where matter_id = p_matter_id;
    insert into public.matter_opening_revisions (
      matter_id, owner_id, revision, record, reason
    )
    select matter_id, owner_id, v_revision, record, 'principal correction'
      from public.matter_openings where matter_id = p_matter_id;
  end if;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (p_matter_id, p_owner_id, p_turn_key, 'student', p_expected_step, p_student_message),
    (p_matter_id, p_owner_id, p_turn_key, 'assistant', p_workflow_state->>'step', p_assistant_message);

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        revision = case when p_expected_step = 'MO08_CONFIRM' then revision + 1 else revision end,
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  update public.matters
    set current_step = p_workflow_state->>'step',
        progress = p_progress,
        status = case
          when p_workflow_state->>'step' = 'STOPPED' then 'stopped'
          else 'matter_opening'
        end,
        stop_state = p_workflow_state->'stop',
        updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step,
    metadata
  )
  select p_matter_id, p_owner_id, 'turn_completed', workflow_version,
         p_workflow_state->>'step', jsonb_build_object('turn_key', p_turn_key)
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

create or replace function public.confirm_matter_opening(
  p_matter_id uuid,
  p_owner_id uuid,
  p_record jsonb,
  p_workflow_state jsonb,
  p_confirmation_message text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_step text;
  v_revision integer;
  v_turn_key uuid := gen_random_uuid();
begin
  select owner_id, current_step
    into v_owner, v_step
    from public.matters
    where id = p_matter_id
    for update;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if v_step <> 'MO08_CONFIRM' or p_workflow_state->>'step' <> 'CONFIRMED' then
    raise exception 'opening confirmation gate is not satisfied';
  end if;

  select revision + 1 into v_revision
    from public.matter_openings where matter_id = p_matter_id;
  insert into public.matter_opening_revisions (
    matter_id, owner_id, revision, record, reason
  )
  select matter_id, owner_id, v_revision, p_record, 'principal confirmation'
    from public.matter_openings where matter_id = p_matter_id;

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        revision = v_revision,
        confirmed_at = now(),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  update public.matters
    set current_step = 'CONFIRMED',
        progress = 100,
        status = 'opening_confirmed',
        opening_confirmed_at = now(),
        updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values (p_matter_id, p_owner_id, v_turn_key, 'assistant', 'CONFIRMED', p_confirmation_message);

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step
  )
  select p_matter_id, p_owner_id, 'matter_opening_confirmed', workflow_version, 'CONFIRMED'
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

revoke all on function public.create_slice1_matter(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.apply_matter_opening_turn(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.confirm_matter_opening(uuid, uuid, jsonb, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.create_slice1_matter(uuid, text, text) to service_role;
grant execute on function public.apply_matter_opening_turn(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, integer
) to service_role;
grant execute on function public.confirm_matter_opening(uuid, uuid, jsonb, jsonb, text)
  to service_role;

comment on table public.matters is
  'Slice 1 matters. Application code accepts synthetic data only until a cohort policy is approved.';
