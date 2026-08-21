alter table public.matters drop constraint matters_status_check;
alter table public.matters
  add constraint matters_status_check
  check (status in ('matter_opening', 'stopped', 'blueprint_ready', 'blueprint_in_progress'));

create table public.blueprint_states (
  matter_id uuid primary key references public.matters(id) on delete cascade,
  owner_id uuid not null,
  state jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_records (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  owner_id uuid not null,
  decision_id text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matter_id, decision_id)
);

create table public.evidence_files (
  id uuid primary key,
  matter_id uuid not null references public.matters(id) on delete cascade,
  owner_id uuid not null,
  filename text,
  storage_path text,
  status text not null check (status in ('processed', 'unavailable', 'failed')),
  treatment jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index decision_records_matter_idx
  on public.decision_records (matter_id, created_at);
create index evidence_files_matter_idx
  on public.evidence_files (matter_id, created_at);

alter table public.blueprint_states enable row level security;
alter table public.decision_records enable row level security;
alter table public.evidence_files enable row level security;

create policy blueprint_states_select_own
  on public.blueprint_states for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy decision_records_select_own
  on public.decision_records for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy evidence_files_select_own
  on public.evidence_files for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.blueprint_states from anon;
revoke all on public.decision_records from anon;
revoke all on public.evidence_files from anon;
grant select on public.blueprint_states to authenticated;
grant select on public.decision_records to authenticated;
grant select on public.evidence_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blueprint-evidence',
  'blueprint-evidence',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.start_blueprint(
  p_matter_id uuid,
  p_owner_id uuid,
  p_state jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_status text;
  v_confirmed boolean;
begin
  select m.owner_id, m.status,
         o.confirmed_at is not null and o.record->>'principal_confirmed' = 'yes'
    into v_owner, v_status, v_confirmed
    from public.matters m
    join public.matter_openings o on o.matter_id = m.id
    where m.id = p_matter_id
    for update of m, o;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if not v_confirmed or v_status not in ('blueprint_ready', 'blueprint_in_progress') then
    raise exception 'confirmed planning summary required';
  end if;

  insert into public.blueprint_states (matter_id, owner_id, state, revision)
  values (
    p_matter_id,
    p_owner_id,
    p_state,
    coalesce((p_state->>'revision')::integer, 0)
  )
  on conflict (matter_id) do nothing;

  update public.matters
    set status = 'blueprint_in_progress', updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'blueprint_entered',
         p_state->>'workflow_version',
         'BLUEPRINT_' || (p_state->>'current_gate'),
         jsonb_build_object('phase', p_state->>'phase')
    from public.matters where id = p_matter_id
  on conflict do nothing;

  return true;
end;
$$;

create or replace function public.apply_blueprint_turn(
  p_matter_id uuid,
  p_owner_id uuid,
  p_turn_key uuid,
  p_expected_state jsonb,
  p_student_message text,
  p_assistant_message text,
  p_state jsonb,
  p_decision jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
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
    where matter_id = p_matter_id and turn_key = p_turn_key and role = 'student'
  ) then
    return true;
  end if;
  if v_state <> p_expected_state then
    raise exception 'stale blueprint state';
  end if;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (
      p_matter_id, p_owner_id, p_turn_key, 'student',
      'BLUEPRINT_' || (v_state->>'current_gate'), p_student_message
    ),
    (
      p_matter_id, p_owner_id, p_turn_key, 'assistant',
      'BLUEPRINT_' || (p_state->>'current_gate'), p_assistant_message
    );

  update public.blueprint_states
    set state = p_state,
        revision = coalesce((p_state->>'revision')::integer, revision + 1),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;

  if p_decision is not null then
    insert into public.decision_records (
      matter_id, owner_id, decision_id, record
    ) values (
      p_matter_id, p_owner_id, p_decision->>'decision_id', p_decision
    )
    on conflict (matter_id, decision_id) do update
      set record = excluded.record, updated_at = now();
  end if;

  update public.matters set updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'blueprint_turn_completed',
         p_state->>'workflow_version',
         'BLUEPRINT_' || (p_state->>'current_gate'),
         jsonb_build_object(
           'turn_key', p_turn_key,
           'phase', p_state->>'phase',
           'interaction_kind', p_state#>>'{interaction,kind}'
         )
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

create or replace function public.apply_blueprint_evidence(
  p_matter_id uuid,
  p_owner_id uuid,
  p_turn_key uuid,
  p_expected_state jsonb,
  p_state jsonb,
  p_evidence jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
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
    where matter_id = p_matter_id and turn_key = p_turn_key and role = 'student'
  ) then
    return true;
  end if;
  if v_state <> p_expected_state or v_state#>>'{interaction,kind}' <> 'evidence' then
    raise exception 'focused evidence checkpoint is not active';
  end if;

  insert into public.evidence_files (
    id, matter_id, owner_id, filename, storage_path, status, treatment
  ) values (
    (p_evidence->>'id')::uuid,
    p_matter_id,
    p_owner_id,
    p_evidence->>'filename',
    p_evidence->>'storage_path',
    p_evidence->>'status',
    p_evidence->'treatment'
  );

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (
      p_matter_id, p_owner_id, p_turn_key, 'student', 'BLUEPRINT_3',
      case when p_evidence->>'status' = 'processed'
        then 'Relevant evidence provided.' else 'Evidence is not available now.' end
    ),
    (
      p_matter_id, p_owner_id, p_turn_key, 'assistant',
      'BLUEPRINT_' || (p_state->>'current_gate'),
      'The focused evidence treatment is saved.'
    );

  update public.blueprint_states
    set state = p_state,
        revision = coalesce((p_state->>'revision')::integer, revision + 1),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;
  update public.matters set updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'evidence_checkpoint_completed',
         p_state->>'workflow_version',
         'BLUEPRINT_3', jsonb_build_object('status', p_evidence->>'status')
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

revoke all on function public.start_blueprint(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.apply_blueprint_turn(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.apply_blueprint_evidence(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.start_blueprint(uuid, uuid, jsonb) to service_role;
grant execute on function public.apply_blueprint_turn(
  uuid, uuid, uuid, jsonb, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.apply_blueprint_evidence(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;
