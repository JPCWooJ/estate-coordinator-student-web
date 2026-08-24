alter table public.matters drop constraint matters_status_check;
alter table public.matters
  add constraint matters_status_check
  check (status in (
    'matter_opening',
    'stopped',
    'blueprint_ready',
    'blueprint_in_progress',
    'blueprint_complete'
  ));

create table public.estate_blueprints (
  id uuid primary key,
  matter_id uuid not null unique references public.matters(id) on delete cascade,
  owner_id uuid not null,
  status text not null check (status in ('generating', 'ready')),
  generation_input jsonb not null,
  document jsonb,
  pdf_storage_path text,
  download_filename text not null default 'Estate-Blueprint.pdf',
  frozen_at timestamptz not null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estate_blueprints_ready_payload_check check (
    status <> 'ready' or (
      document is not null and
      pdf_storage_path is not null and
      generated_at is not null
    )
  )
);

create index estate_blueprints_owner_matter_idx
  on public.estate_blueprints (owner_id, matter_id);

alter table public.estate_blueprints enable row level security;

create policy estate_blueprints_select_own
  on public.estate_blueprints for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.estate_blueprints from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.estate_blueprints from authenticated;
grant select on public.estate_blueprints to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estate-blueprints',
  'estate-blueprints',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.apply_final_review_correction(
  p_matter_id uuid,
  p_owner_id uuid,
  p_turn_key uuid,
  p_expected_state jsonb,
  p_student_message text,
  p_assistant_message text,
  p_state jsonb
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
  if v_state <> p_expected_state or
     v_state#>>'{interaction,kind}' <> 'final_review' or
     p_state#>>'{interaction,kind}' <> 'final_review' then
    raise exception 'final review is not active';
  end if;

  insert into public.messages (matter_id, owner_id, turn_key, role, step, content)
  values
    (
      p_matter_id, p_owner_id, p_turn_key, 'student',
      'BLUEPRINT_7_FINAL_REVIEW', p_student_message
    ),
    (
      p_matter_id, p_owner_id, p_turn_key, 'assistant',
      'BLUEPRINT_7_FINAL_REVIEW', p_assistant_message
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
  select p_matter_id, p_owner_id, 'blueprint_final_review_corrected',
         p_state->>'workflow_version', 'BLUEPRINT_7_FINAL_REVIEW',
         jsonb_build_object('turn_key', p_turn_key)
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

create or replace function public.freeze_estate_blueprint(
  p_matter_id uuid,
  p_owner_id uuid,
  p_blueprint_id uuid,
  p_expected_state jsonb,
  p_state jsonb,
  p_generation_input jsonb,
  p_download_filename text,
  p_frozen_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_existing_id uuid;
  v_existing_owner uuid;
  v_existing_input jsonb;
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

  select id, owner_id, generation_input
    into v_existing_id, v_existing_owner, v_existing_input
    from public.estate_blueprints
    where matter_id = p_matter_id
    for update;
  if v_existing_id is not null then
    if v_existing_id = p_blueprint_id and
       v_existing_owner = p_owner_id and
       v_existing_input = p_generation_input then
      return true;
    end if;
    raise exception 'estate blueprint input is already frozen';
  end if;

  if v_state <> p_expected_state or
     v_state#>>'{interaction,kind}' <> 'final_review' or
     p_state#>>'{interaction,kind}' <> 'generating' or
     p_state->>'generation_snapshot_id' <> p_blueprint_id::text or
     p_generation_input->>'blueprint_id' <> p_blueprint_id::text or
     p_generation_input->>'matter_id' <> p_matter_id::text or
     (p_generation_input->>'frozen_at')::timestamptz is distinct from p_frozen_at then
    raise exception 'invalid or stale estate blueprint freeze';
  end if;

  insert into public.estate_blueprints (
    id, matter_id, owner_id, status, generation_input,
    download_filename, frozen_at
  ) values (
    p_blueprint_id, p_matter_id, p_owner_id, 'generating', p_generation_input,
    p_download_filename, p_frozen_at
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
  select p_matter_id, p_owner_id, 'blueprint_generation_started',
         p_state->>'workflow_version', 'BLUEPRINT_7',
         jsonb_build_object('blueprint_id', p_blueprint_id)
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

create or replace function public.complete_estate_blueprint(
  p_matter_id uuid,
  p_owner_id uuid,
  p_blueprint_id uuid,
  p_expected_state jsonb,
  p_state jsonb,
  p_document jsonb,
  p_pdf_storage_path text,
  p_generated_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_state jsonb;
  v_status text;
begin
  select m.owner_id, b.state, e.status
    into v_owner, v_state, v_status
    from public.matters m
    join public.blueprint_states b on b.matter_id = m.id
    join public.estate_blueprints e
      on e.matter_id = m.id and e.id = p_blueprint_id
    where m.id = p_matter_id
    for update of m, b, e;

  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'matter not found';
  end if;
  if v_status = 'ready' then
    return true;
  end if;
  if v_state <> p_expected_state or
     v_state#>>'{interaction,kind}' <> 'generating' or
     v_state#>>'{interaction,blueprint_id}' <> p_blueprint_id::text or
     p_state#>>'{interaction,kind}' <> 'blueprint' or
     p_state#>>'{interaction,blueprint_id}' <> p_blueprint_id::text or
     p_document->>'source_snapshot_id' <> p_blueprint_id::text or
     nullif(trim(p_pdf_storage_path), '') is null then
    raise exception 'invalid or stale estate blueprint completion';
  end if;

  update public.estate_blueprints
    set status = 'ready',
        document = p_document,
        pdf_storage_path = p_pdf_storage_path,
        generated_at = p_generated_at,
        updated_at = now()
    where id = p_blueprint_id
      and matter_id = p_matter_id
      and owner_id = p_owner_id;
  update public.blueprint_states
    set state = p_state,
        revision = coalesce((p_state->>'revision')::integer, revision),
        updated_at = now()
    where matter_id = p_matter_id and owner_id = p_owner_id;
  update public.matters
    set status = 'blueprint_complete', updated_at = now()
    where id = p_matter_id and owner_id = p_owner_id;

  insert into public.analytics_events (
    matter_id, owner_id, event_name, workflow_version, step, metadata
  )
  select p_matter_id, p_owner_id, 'blueprint_generated',
         p_state->>'workflow_version', 'ESTATE_BLUEPRINT',
         jsonb_build_object('blueprint_id', p_blueprint_id)
    from public.matters where id = p_matter_id;

  return true;
end;
$$;

revoke all on function public.apply_final_review_correction(
  uuid, uuid, uuid, jsonb, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.freeze_estate_blueprint(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.complete_estate_blueprint(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_final_review_correction(
  uuid, uuid, uuid, jsonb, text, text, jsonb
) to service_role;
grant execute on function public.freeze_estate_blueprint(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz
) to service_role;
grant execute on function public.complete_estate_blueprint(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz
) to service_role;
