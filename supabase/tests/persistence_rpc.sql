begin;

do $$
declare
  v_owner uuid := '33333333-3333-4333-8333-333333333333';
  v_matter uuid;
  v_turn uuid := '44444444-4444-4444-8444-444444444444';
  v_correction_turn uuid := '55555555-5555-4555-8555-555555555555';
  v_blueprint_turn uuid := '66666666-6666-4666-8666-666666666666';
  v_final_review_turn uuid := '77777777-7777-4777-8777-777777777777';
  v_blueprint_id uuid := '88888888-8888-4888-8888-888888888888';
  v_frozen_at timestamptz := '2026-08-23T20:00:00Z';
  v_record jsonb;
  v_corrected_record jsonb;
  v_saved_revision jsonb;
  v_state jsonb;
  v_next_state jsonb;
  v_blueprint_state jsonb;
  v_next_blueprint_state jsonb;
  v_generation_input jsonb;
  v_document jsonb;
  v_message_count integer;
  v_revision_count integer;
  v_decision_count integer;
  v_status text;
begin
  v_matter := public.create_slice1_matter(
    v_owner, 'Synthetic RPC Matter', 'EC_MATTER_OPENING_0.4'
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

  v_blueprint_state := jsonb_build_object(
    'workflow_version', 'EC_ESTATE_BLUEPRINT_0.7',
    'phase', 'BLUEPRINT_DECISIONS',
    'current_gate', 4,
    'revision', 0,
    'interaction', jsonb_build_object('kind', 'recommendation')
  );
  perform public.start_blueprint(v_matter, v_owner, v_blueprint_state);

  select status into v_status from public.matters where id = v_matter;
  if v_status <> 'blueprint_in_progress' then
    raise exception 'Persistence failure: Blueprint status was %', v_status;
  end if;

  v_next_blueprint_state := v_blueprint_state || jsonb_build_object(
    'current_gate', 5,
    'revision', 1,
    'interaction', jsonb_build_object('kind', 'question')
  );
  perform public.apply_blueprint_turn(
    v_matter, v_owner, v_blueprint_turn, v_blueprint_state,
    'I accept this recommendation.', 'The decision is saved.',
    v_next_blueprint_state,
    jsonb_build_object(
      'decision_id', 'BR-004-BENEFICIARY',
      'principal_response', 'accept'
    )
  );
  perform public.apply_blueprint_turn(
    v_matter, v_owner, v_blueprint_turn, v_blueprint_state,
    'Duplicate retry.', 'Duplicate retry.',
    v_next_blueprint_state,
    jsonb_build_object(
      'decision_id', 'BR-004-BENEFICIARY',
      'principal_response', 'modify'
    )
  );

  select count(*) into v_decision_count
    from public.decision_records
    where matter_id = v_matter and decision_id = 'BR-004-BENEFICIARY';
  select state into v_blueprint_state
    from public.blueprint_states where matter_id = v_matter;
  if v_decision_count <> 1 or v_blueprint_state <> v_next_blueprint_state then
    raise exception 'Persistence failure: Blueprint decision or resume state was not idempotent';
  end if;

  v_blueprint_state := jsonb_build_object(
    'workflow_version', 'EC_ESTATE_BLUEPRINT_0.7',
    'phase', 'FINAL_REVIEW',
    'current_gate', 7,
    'revision', 2,
    'interaction', jsonb_build_object('kind', 'final_review')
  );
  update public.blueprint_states
    set state = v_blueprint_state, revision = 2
    where matter_id = v_matter;
  v_next_blueprint_state := v_blueprint_state || jsonb_build_object(
    'revision', 3,
    'interaction', jsonb_build_object('kind', 'final_review')
  );

  perform public.apply_final_review_correction(
    v_matter, v_owner, v_final_review_turn, v_blueprint_state,
    'Preserve $6 million.', 'The planning baseline was corrected.',
    v_next_blueprint_state
  );
  perform public.apply_final_review_correction(
    v_matter, v_owner, v_final_review_turn, v_blueprint_state,
    'Duplicate correction.', 'Duplicate correction.',
    v_next_blueprint_state
  );
  select count(*) into v_message_count
    from public.messages
    where matter_id = v_matter and turn_key = v_final_review_turn;
  if v_message_count <> 2 then
    raise exception 'Persistence failure: idempotent Final Review correction wrote % messages', v_message_count;
  end if;

  v_blueprint_state := v_next_blueprint_state;
  v_next_blueprint_state := v_blueprint_state || jsonb_build_object(
    'phase', 'ESTATE_BLUEPRINT',
    'revision', 4,
    'generation_snapshot_id', v_blueprint_id,
    'interaction', jsonb_build_object(
      'kind', 'generating', 'blueprint_id', v_blueprint_id
    )
  );
  v_generation_input := jsonb_build_object(
    'blueprint_id', v_blueprint_id,
    'matter_id', v_matter,
    'frozen_at', v_frozen_at,
    'profile', jsonb_build_object('planning_baseline', 'Preserve $6 million.')
  );

  perform public.freeze_estate_blueprint(
    v_matter, v_owner, v_blueprint_id, v_blueprint_state,
    v_next_blueprint_state, v_generation_input,
    'Estate-Blueprint.pdf', v_frozen_at
  );
  perform public.freeze_estate_blueprint(
    v_matter, v_owner, v_blueprint_id, v_blueprint_state,
    v_next_blueprint_state, v_generation_input,
    'Estate-Blueprint.pdf', v_frozen_at
  );

  v_blueprint_state := v_next_blueprint_state;
  v_next_blueprint_state := v_blueprint_state || jsonb_build_object(
    'interaction', jsonb_build_object(
      'kind', 'blueprint', 'blueprint_id', v_blueprint_id
    )
  );
  v_document := jsonb_build_object(
    'source_snapshot_id', v_blueprint_id,
    'title', 'Estate Blueprint'
  );
  perform public.complete_estate_blueprint(
    v_matter, v_owner, v_blueprint_id, v_blueprint_state,
    v_next_blueprint_state, v_document,
    v_owner::text || '/' || v_matter::text || '/' || v_blueprint_id::text || '.pdf',
    '2026-08-23T20:01:00Z'
  );
  perform public.complete_estate_blueprint(
    v_matter, v_owner, v_blueprint_id, v_blueprint_state,
    v_next_blueprint_state, v_document,
    v_owner::text || '/' || v_matter::text || '/' || v_blueprint_id::text || '.pdf',
    '2026-08-23T20:01:00Z'
  );

  select status into v_status from public.matters where id = v_matter;
  if v_status <> 'blueprint_complete' or not exists (
    select 1 from public.estate_blueprints
    where id = v_blueprint_id
      and matter_id = v_matter
      and owner_id = v_owner
      and status = 'ready'
      and generation_input = v_generation_input
      and document = v_document
      and pdf_storage_path is not null
  ) then
    raise exception 'Persistence failure: frozen Estate Blueprint did not complete exactly';
  end if;
end;
$$;

select 'PASS: opening, decisions, Final Review, immutable generation, and Blueprint completion persist' as persistence_result;

rollback;
