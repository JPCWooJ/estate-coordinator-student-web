begin;

do $$
declare
  v_owner uuid := '33333333-3333-4333-8333-333333333333';
  v_matter uuid;
  v_turn uuid := '44444444-4444-4444-8444-444444444444';
  v_correction_turn uuid := '55555555-5555-4555-8555-555555555555';
  v_record jsonb;
  v_corrected_record jsonb;
  v_saved_revision jsonb;
  v_state jsonb;
  v_next_state jsonb;
  v_message_count integer;
  v_revision_count integer;
  v_status text;
begin
  v_matter := public.create_slice1_matter(
    v_owner, 'Synthetic RPC Matter', 'EC_MATTER_OPENING_0.3'
  );

  select record, workflow_state into v_record, v_state
    from public.matter_openings where matter_id = v_matter;
  if v_state <> jsonb_build_object(
    'step', 'MO01_OUTCOMES', 'clarification', null, 'stop', null
  ) then
    raise exception 'Persistence failure: new record state was %', v_state;
  end if;
  v_record := v_record || jsonb_build_object(
    'desired_outcomes', jsonb_build_array('intended_transfer'),
    'principal_definition_of_success', 'Synthetic persistence proof.'
  );
  v_next_state := jsonb_build_object(
    'step', 'MO01_PRIORITIES', 'clarification', null, 'stop', null
  );

  perform public.apply_matter_opening_turn(
    v_matter, v_owner, v_turn, v_state,
    'Synthetic accepted answer.', 'Synthetic acknowledgement.',
    v_record, v_next_state
  );
  perform public.apply_matter_opening_turn(
    v_matter, v_owner, v_turn, v_state,
    'Synthetic duplicate answer.', 'Synthetic duplicate acknowledgement.',
    v_record, v_next_state
  );

  select count(*) into v_message_count
    from public.messages where matter_id = v_matter and turn_key = v_turn;
  if v_message_count <> 2 then
    raise exception 'Persistence failure: idempotent turn wrote % messages', v_message_count;
  end if;

  select record, workflow_state into v_record, v_state
    from public.matter_openings where matter_id = v_matter;
  if v_state <> v_next_state or
     v_record->'desired_outcomes' <> jsonb_build_array('intended_transfer') then
    raise exception 'Persistence failure: accepted record did not resume exactly';
  end if;

  v_record := v_record || jsonb_build_object(
    'principal_definition_of_success', 'Before correction.'
  );
  v_state := jsonb_build_object(
    'step', 'MO08_CONFIRM', 'clarification', null, 'stop', null
  );
  update public.matter_openings
    set record = v_record, workflow_state = v_state
    where matter_id = v_matter;
  v_corrected_record := v_record || jsonb_build_object(
    'principal_definition_of_success', 'After correction.'
  );

  perform public.correct_matter_opening_summary(
    v_matter, v_owner, v_correction_turn, v_state,
    'Use the corrected definition.', 'The definition of success was updated.',
    v_corrected_record, v_state, true
  );

  select count(*) into v_revision_count
    from public.matter_opening_revisions
    where matter_id = v_matter and reason = 'principal correction';
  select record into v_saved_revision
    from public.matter_opening_revisions
    where matter_id = v_matter and reason = 'principal correction';
  if v_revision_count <> 1 or v_saved_revision <> v_record then
    raise exception 'Persistence failure: correction revision did not preserve the prior record';
  end if;

  select record, workflow_state into v_record, v_state
    from public.matter_openings where matter_id = v_matter;
  if v_record <> v_corrected_record or v_state->>'step' <> 'MO08_CONFIRM' then
    raise exception 'Persistence failure: corrected record was not retained';
  end if;

  v_record := v_record || jsonb_build_object(
    'matter_status', 'BLUEPRINT_READY',
    'principal_confirmed', 'yes',
    'confirmation_date', '2026-08-19T20:00:00.000Z'
  );
  v_next_state := jsonb_build_object(
    'step', 'BLUEPRINT_READY', 'clarification', null, 'stop', null
  );

  perform public.confirm_matter_opening(
    v_matter, v_owner, v_state, v_record, v_next_state,
    'Synthetic confirmation saved.'
  );

  select status into v_status from public.matters where id = v_matter;
  if v_status <> 'blueprint_ready' then
    raise exception 'Persistence failure: Blueprint-ready status was %', v_status;
  end if;
  if not exists (
    select 1 from public.matter_openings
    where matter_id = v_matter
      and workflow_state->>'step' = 'BLUEPRINT_READY'
      and record->>'principal_confirmed' = 'yes'
  ) then
    raise exception 'Persistence failure: confirmed planning baseline was not retained';
  end if;
end;
$$;

select 'PASS: new state resumes, correction preserves prior record, and confirmation persists' as persistence_result;

rollback;
