begin;

do $$
declare
  v_owner uuid := '33333333-3333-4333-8333-333333333333';
  v_matter uuid;
  v_turn uuid := '44444444-4444-4444-8444-444444444444';
  v_record jsonb;
  v_state jsonb;
  v_message_count integer;
  v_status text;
begin
  v_matter := public.create_slice1_matter(
    v_owner,
    'Synthetic RPC Matter',
    'EC_MATTER_OPENING_0.1'
  );

  select record, workflow_state into v_record, v_state
    from public.matter_openings where matter_id = v_matter;

  v_record := v_record || jsonb_build_object(
    'desired_outcomes', jsonb_build_array('intended_transfer'),
    'principal_definition_of_success', 'Synthetic persistence proof.'
  );
  v_state := v_state || jsonb_build_object(
    'step', 'MO08_CONFIRM',
    'accepted_turns', 1
  );

  perform public.apply_matter_opening_turn(
    v_matter,
    v_owner,
    v_turn,
    'MO01_OUTCOMES',
    'Synthetic accepted answer.',
    'Synthetic acknowledgement.',
    v_record,
    v_state,
    95
  );

  perform public.apply_matter_opening_turn(
    v_matter,
    v_owner,
    v_turn,
    'MO01_OUTCOMES',
    'Synthetic duplicate answer.',
    'Synthetic duplicate acknowledgement.',
    v_record,
    v_state,
    95
  );

  select count(*) into v_message_count
    from public.messages
    where matter_id = v_matter and turn_key = v_turn;
  if v_message_count <> 2 then
    raise exception 'Persistence failure: idempotent turn wrote % messages', v_message_count;
  end if;

  v_record := v_record || jsonb_build_object(
    'principal_confirmed', 'yes',
    'confirmation_date', '2026-08-17T20:00:00.000Z'
  );
  v_state := v_state || jsonb_build_object('step', 'CONFIRMED');

  perform public.confirm_matter_opening(
    v_matter,
    v_owner,
    v_record,
    v_state,
    'Synthetic confirmation saved.'
  );

  select status into v_status from public.matters where id = v_matter;
  if v_status <> 'opening_confirmed' then
    raise exception 'Persistence failure: confirmed status was %', v_status;
  end if;
  if not exists (
    select 1 from public.matter_openings
    where matter_id = v_matter
      and workflow_state->>'step' = 'CONFIRMED'
      and record->>'principal_confirmed' = 'yes'
  ) then
    raise exception 'Persistence failure: confirmed structured record was not retained';
  end if;
end;
$$;

select 'PASS: accepted turn is idempotent and confirmed record persists' as persistence_result;

rollback;
