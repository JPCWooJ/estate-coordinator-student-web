create or replace function public.create_mvp_rescue_matter(
  p_matter_id uuid,
  p_owner_id uuid,
  p_name text,
  p_workflow_version text,
  p_record jsonb,
  p_workflow_state jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.matters where owner_id = p_owner_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.matters (id, owner_id, name, workflow_version)
  values (p_matter_id, p_owner_id, p_name, p_workflow_version)
  returning id into v_id;

  insert into public.matter_openings (
    matter_id, owner_id, record, workflow_state
  ) values (
    v_id,
    p_owner_id,
    jsonb_set(p_record, '{matter_id}', to_jsonb(v_id::text)),
    p_workflow_state
  );

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step
  ) values (
    v_id,
    p_owner_id,
    'matter_started',
    p_workflow_version,
    p_workflow_state->>'step'
  );

  return v_id;
end;
$$;

create or replace function public.save_mvp_rescue_intake(
  p_matter_id uuid,
  p_owner_id uuid,
  p_operation_id uuid,
  p_expected_revision integer,
  p_record jsonb,
  p_workflow_state jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_record jsonb;
  v_revision integer;
  v_updated_at timestamptz;
  v_already_committed boolean;
begin
  select m.owner_id, o.record, o.revision
    into v_owner, v_record, v_revision
    from public.matters m
    join public.matter_openings o on o.matter_id = m.id
    where m.id = p_matter_id
    for update of m, o;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;

  select exists (
    select 1
      from jsonb_array_elements_text(
        coalesce(v_record#>'{canonical_intake,processedOperationIds}', '[]'::jsonb)
      ) operation_id
      where operation_id = p_operation_id::text
  ) into v_already_committed;

  if v_already_committed then
    select updated_at into v_updated_at
      from public.matter_openings where matter_id = p_matter_id;
    return jsonb_build_object(
      'record', v_record,
      'workflow_state', (
        select workflow_state from public.matter_openings where matter_id = p_matter_id
      ),
      'revision', v_revision,
      'committed_at', v_updated_at
    );
  end if;

  if v_revision <> p_expected_revision then
    raise exception 'stale intake revision';
  end if;

  update public.matter_openings
    set record = p_record,
        workflow_state = p_workflow_state,
        revision = v_revision + 1,
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id
    returning revision, updated_at into v_revision, v_updated_at;

  update public.matters
    set status = 'matter_opening', updated_at = v_updated_at
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'structured_intake_committed',
         workflow_version, p_workflow_state->>'step',
         jsonb_build_object('operation_id', p_operation_id, 'revision', v_revision)
    from public.matters where id = p_matter_id;

  return jsonb_build_object(
    'record', p_record,
    'workflow_state', p_workflow_state,
    'revision', v_revision,
    'committed_at', v_updated_at
  );
end;
$$;

revoke all on function public.create_mvp_rescue_matter(
  uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.save_mvp_rescue_intake(
  uuid, uuid, uuid, integer, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.create_mvp_rescue_matter(
  uuid, uuid, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.save_mvp_rescue_intake(
  uuid, uuid, uuid, integer, jsonb, jsonb
) to service_role;

create or replace function public.apply_blueprint_decisions_batch(
  p_matter_id uuid,
  p_owner_id uuid,
  p_operation_id uuid,
  p_expected_state jsonb,
  p_state jsonb,
  p_decisions jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_decision jsonb;
begin
  select m.owner_id, b.state
    into v_owner, v_state
    from public.matters m
    join public.blueprint_states b on b.matter_id = m.id
    where m.id = p_matter_id
    for update of m, b;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if exists (
    select 1 from public.messages
      where matter_id = p_matter_id
        and turn_key = p_operation_id
        and role = 'student'
  ) then
    return true;
  end if;
  if v_state <> p_expected_state or v_state#>>'{interaction,kind}' <> 'recommendations' then
    raise exception 'consolidated Blueprint decisions are not active';
  end if;

  insert into public.messages (
    matter_id, owner_id, turn_key, role, step, content
  ) values (
    p_matter_id, p_owner_id, p_operation_id, 'student', 'BLUEPRINT_6',
    'Consolidated Blueprint decisions submitted.'
  );

  update public.blueprint_states
    set state = p_state,
        revision = coalesce((p_state->>'revision')::integer, revision + 1),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  for v_decision in select value from jsonb_array_elements(p_decisions)
  loop
    insert into public.decision_records (
      matter_id, owner_id, decision_id, record
    ) values (
      p_matter_id, p_owner_id, v_decision->>'decision_id', v_decision
    )
    on conflict (matter_id, decision_id) do update
      set record = excluded.record, updated_at = now();
  end loop;

  update public.matters set updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'blueprint_decisions_committed',
         p_state->>'workflow_version', 'BLUEPRINT_6',
         jsonb_build_object(
           'operation_id', p_operation_id,
           'decision_count', jsonb_array_length(p_decisions)
         )
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

revoke all on function public.apply_blueprint_decisions_batch(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_blueprint_decisions_batch(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;
