update public.matter_openings
set record = (record - 'selected_discovery_path' - 'single_next_action') ||
    jsonb_build_object(
      'matter_status',
      case
        when workflow_state->>'step' = 'CONFIRMED' then 'BLUEPRINT_READY'
        else coalesce(record->>'matter_status', 'OPEN')
      end
    ),
    workflow_state =
      (workflow_state - 'goal_followup_queue' - 'active_goal_followup' - 'accepted_turns') ||
      jsonb_build_object(
        'step',
        case
          when workflow_state->>'step' = 'CONFIRMED' then 'BLUEPRINT_READY'
          else workflow_state->>'step'
        end,
        'clarification', null
      ),
    updated_at = now();

alter table public.matters drop constraint matters_status_check;
update public.matters
set status = case when status = 'opening_confirmed' then 'blueprint_ready' else status end,
    workflow_version = 'EC_MATTER_OPENING_0.3',
    updated_at = now();
alter table public.matters
  add constraint matters_status_check
  check (status in ('matter_opening', 'stopped', 'blueprint_ready'));

drop function if exists public.apply_matter_opening_turn(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, integer
);
drop function if exists public.confirm_matter_opening(uuid, uuid, jsonb, jsonb, text);

alter table public.matters
  drop column current_stage,
  drop column current_step,
  drop column progress;

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

  insert into public.matters (owner_id, name, workflow_version)
  values (p_owner_id, p_name, p_workflow_version)
  returning id into v_id;

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
      'current_plan_status', 'unknown',
      'changes_since_current_plan', '[]'::jsonb,
      'timing_event_or_deadline', jsonb_build_object(
        'reason', 'unknown', 'event', 'unknown', 'date', 'unknown', 'importance', 'unknown'
      ),
      'geographic_and_complexity_flags', '[]'::jsonb,
      'professional_and_family_contacts', '[]'::jsonb,
      'missing_contacts', '[]'::jsonb,
      'other_participants', '[]'::jsonb,
      'house_in_order_concern', 'unknown',
      'principal_confirmed', 'no',
      'confirmation_date', 'unknown'
    ),
    jsonb_build_object('step', 'MO01_OUTCOMES', 'clarification', null, 'stop', null)
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
  p_expected_workflow_state jsonb,
  p_student_message text,
  p_assistant_message text,
  p_record jsonb,
  p_workflow_state jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
begin
  select m.owner_id, o.workflow_state
    into v_owner, v_state
    from public.matters m
    join public.matter_openings o on o.matter_id = m.id
    where m.id = p_matter_id
    for update of m, o;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if exists (
    select 1 from public.messages
    where matter_id = p_matter_id and turn_key = p_turn_key and role = 'student'
  ) then
    return true;
  end if;
  if v_state <> p_expected_workflow_state then
    raise exception 'stale workflow state';
  end if;
  if coalesce(v_state->>'step', '') in ('MO08_CONFIRM', 'BLUEPRINT_READY', 'STOPPED') then
    raise exception 'ordinary turn is not available in this workflow state';
  end if;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (p_matter_id, p_owner_id, p_turn_key, 'student', v_state->>'step', p_student_message),
    (p_matter_id, p_owner_id, p_turn_key, 'assistant', p_workflow_state->>'step', p_assistant_message);

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  update public.matters
    set status = case
          when p_workflow_state->>'step' = 'STOPPED' then 'stopped'
          else 'matter_opening'
        end,
        stop_state = p_workflow_state->'stop',
        updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'turn_completed', workflow_version,
         p_workflow_state->>'step', jsonb_build_object('turn_key', p_turn_key)
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

create or replace function public.correct_matter_opening_summary(
  p_matter_id uuid,
  p_owner_id uuid,
  p_turn_key uuid,
  p_expected_workflow_state jsonb,
  p_student_message text,
  p_assistant_message text,
  p_record jsonb,
  p_workflow_state jsonb,
  p_record_changed boolean
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_revision integer;
begin
  select m.owner_id, o.workflow_state
    into v_owner, v_state
    from public.matters m
    join public.matter_openings o on o.matter_id = m.id
    where m.id = p_matter_id
    for update of m, o;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if exists (
    select 1 from public.messages
    where matter_id = p_matter_id and turn_key = p_turn_key and role = 'student'
  ) then
    return true;
  end if;
  if v_state <> p_expected_workflow_state or v_state->>'step' <> 'MO08_CONFIRM' then
    raise exception 'planning summary correction gate is not satisfied';
  end if;

  if p_record_changed then
    select revision + 1 into v_revision
      from public.matter_openings where matter_id = p_matter_id;
    insert into public.matter_opening_revisions (
      matter_id, owner_id, revision, record, reason
    ) values (
      p_matter_id, p_owner_id, v_revision, p_record, 'principal correction'
    );
  end if;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (p_matter_id, p_owner_id, p_turn_key, 'student', 'MO08_CONFIRM', p_student_message),
    (p_matter_id, p_owner_id, p_turn_key, 'assistant', 'MO08_CONFIRM', p_assistant_message);

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        revision = case when p_record_changed then v_revision else revision end,
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  update public.matters set updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  return true;
end;
$$;

create or replace function public.confirm_matter_opening(
  p_matter_id uuid,
  p_owner_id uuid,
  p_expected_workflow_state jsonb,
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
  v_state jsonb;
  v_revision integer;
  v_turn_key uuid := gen_random_uuid();
begin
  select m.owner_id, o.workflow_state
    into v_owner, v_state
    from public.matters m
    join public.matter_openings o on o.matter_id = m.id
    where m.id = p_matter_id
    for update of m, o;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if v_state <> p_expected_workflow_state or
     v_state->>'step' <> 'MO08_CONFIRM' or
     p_workflow_state->>'step' <> 'BLUEPRINT_READY' then
    raise exception 'opening confirmation gate is not satisfied';
  end if;

  select revision + 1 into v_revision
    from public.matter_openings where matter_id = p_matter_id;
  insert into public.matter_opening_revisions (
    matter_id, owner_id, revision, record, reason
  ) values (
    p_matter_id, p_owner_id, v_revision, p_record, 'principal confirmation'
  );

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        revision = v_revision,
        confirmed_at = now(),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  update public.matters
    set status = 'blueprint_ready',
        opening_confirmed_at = now(),
        updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values (p_matter_id, p_owner_id, v_turn_key, 'assistant', 'BLUEPRINT_READY', p_confirmation_message);

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step
  )
  select p_matter_id, p_owner_id, 'matter_opening_confirmed', workflow_version, 'BLUEPRINT_READY'
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

revoke all on function public.apply_matter_opening_turn(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.correct_matter_opening_summary(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb, boolean
) from public, anon, authenticated;
revoke all on function public.confirm_matter_opening(
  uuid, uuid, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.apply_matter_opening_turn(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.correct_matter_opening_summary(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb, boolean
) to service_role;
grant execute on function public.confirm_matter_opening(
  uuid, uuid, jsonb, jsonb, jsonb, text
) to service_role;
