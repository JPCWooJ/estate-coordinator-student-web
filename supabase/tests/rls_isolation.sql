begin;

insert into public.matters (
  id, owner_id, name, status, workflow_version, current_stage, current_step, progress
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'Synthetic User A Matter',
    'matter_opening',
    'EC_MATTER_OPENING_0.1',
    'matter_opening',
    'MO01_OUTCOMES',
    12
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'Synthetic User B Matter',
    'matter_opening',
    'EC_MATTER_OPENING_0.1',
    'matter_opening',
    'MO01_OUTCOMES',
    12
  );

insert into public.matter_openings (matter_id, owner_id, record, workflow_state)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '{}'::jsonb,
    '{"step":"MO01_OUTCOMES"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    '{}'::jsonb,
    '{"step":"MO01_OUTCOMES"}'::jsonb
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
