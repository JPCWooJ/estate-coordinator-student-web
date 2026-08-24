begin;

insert into public.matters (id, owner_id, name, status, workflow_version) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic User A Matter',
    'matter_opening',
    'EC_MATTER_OPENING_0.4'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'Synthetic User B Matter',
    'matter_opening',
    'EC_MATTER_OPENING_0.4'
  );

insert into public.matter_openings (matter_id, owner_id, record, workflow_state)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '{}'::jsonb,
    '{"step":"MO01_OUTCOMES","clarification":null,"stop":null}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '{}'::jsonb,
    '{"step":"MO01_OUTCOMES","clarification":null,"stop":null}'::jsonb
  );

insert into public.blueprint_states (matter_id, owner_id, state) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '{"workflow_version":"EC_ESTATE_BLUEPRINT_0.7","phase":"PLANNING_FOUNDATION","current_gate":2}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '{"workflow_version":"EC_ESTATE_BLUEPRINT_0.7","phase":"BLUEPRINT_DECISIONS","current_gate":4}'::jsonb
  );

insert into public.decision_records (matter_id, owner_id, decision_id, record) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'BR-004-BENEFICIARY',
    '{"principal_response":"accept"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'BR-004-BENEFICIARY',
    '{"principal_response":"defer"}'::jsonb
  );

insert into public.evidence_files (
  id, matter_id, owner_id, status, treatment
) values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'unavailable',
    '{}'::jsonb
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'processed',
    '{}'::jsonb
  );

insert into public.estate_blueprints (
  id, matter_id, owner_id, status, generation_input, frozen_at
) values
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'generating',
    '{"blueprint_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}'::jsonb,
    '2026-08-23T12:00:00Z'
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'generating',
    '{"blueprint_id":"ffffffff-ffff-4fff-8fff-ffffffffffff"}'::jsonb,
    '2026-08-23T12:00:00Z'
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  visible_matters integer;
  foreign_openings integer;
  foreign_blueprints integer;
  foreign_decisions integer;
  foreign_evidence integer;
  foreign_estate_blueprints integer;
  changed_rows integer;
begin
  select count(*) into visible_matters from public.matters;
  if visible_matters <> 1 then
    raise exception 'RLS failure: User A saw % matters instead of 1', visible_matters;
  end if;

  select count(*) into foreign_openings
    from public.matter_openings
    where owner_id = '22222222-2222-4222-8222-222222222222';
  if foreign_openings <> 0 then
    raise exception 'RLS failure: User A read User B opening';
  end if;

  select count(*) into foreign_blueprints
    from public.blueprint_states
    where owner_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into foreign_decisions
    from public.decision_records
    where owner_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into foreign_evidence
    from public.evidence_files
    where owner_id = '22222222-2222-4222-8222-222222222222';
  select count(*) into foreign_estate_blueprints
    from public.estate_blueprints
    where owner_id = '22222222-2222-4222-8222-222222222222';
  if foreign_blueprints <> 0 or
     foreign_decisions <> 0 or
     foreign_evidence <> 0 or
     foreign_estate_blueprints <> 0 then
    raise exception 'RLS failure: User A read User B Blueprint data';
  end if;

  begin
    update public.estate_blueprints
      set download_filename = 'Unauthorized.pdf'
      where owner_id = '22222222-2222-4222-8222-222222222222';
    get diagnostics changed_rows = row_count;
    if changed_rows <> 0 then
      raise exception 'RLS failure: User A mutated User B Estate Blueprint';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.matters
      set name = 'Unauthorized mutation'
      where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    get diagnostics changed_rows = row_count;
    if changed_rows <> 0 then
      raise exception 'RLS failure: User A mutated User B matter';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

select case
  when (select name from public.matters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
       = 'Synthetic User B Matter'
  then 'PASS: cross-user read and mutation blocked'
  else 'FAIL: foreign matter changed'
end as isolation_result;

rollback;
