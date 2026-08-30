create extension if not exists pgcrypto with schema extensions;

create type public.publication_operation_kind as enum ('publish', 'rollback');

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  slug text not null unique,
  published_version_id uuid,
  created_at timestamptz not null default now(),
  constraint sites_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  unique (id, organization_id)
);

create index sites_organization_id_idx on public.sites(organization_id);

create table public.site_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null unique,
  revision integer not null default 1,
  content jsonb not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint site_drafts_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint site_drafts_revision_positive check (revision > 0),
  constraint site_drafts_content_is_object check (jsonb_typeof(content) = 'object'),
  unique (id, site_id, organization_id)
);

create index site_drafts_organization_id_idx on public.site_drafts(organization_id);
create index site_drafts_updated_by_idx on public.site_drafts(updated_by);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null,
  version_number integer not null,
  source_draft_id uuid,
  source_draft_revision integer not null,
  content jsonb not null,
  content_hash text not null,
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  constraint site_versions_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint site_versions_source_draft_tenant_fkey
    foreign key (source_draft_id, site_id, organization_id)
    references public.site_drafts(id, site_id, organization_id)
    deferrable initially deferred,
  constraint site_versions_number_positive check (version_number > 0),
  constraint site_versions_draft_revision_positive
    check (source_draft_revision > 0),
  constraint site_versions_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint site_versions_content_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  unique (id, site_id, organization_id),
  unique (site_id, version_number)
);

create index site_versions_organization_published_at_idx
  on public.site_versions(organization_id, published_at desc);
create index site_versions_site_published_at_idx
  on public.site_versions(site_id, published_at desc);
create index site_versions_source_draft_id_idx
  on public.site_versions(source_draft_id)
  where source_draft_id is not null;
create index site_versions_published_by_idx on public.site_versions(published_by);

alter table public.sites
  add constraint sites_published_version_id_fkey
  foreign key (published_version_id, id, organization_id)
  references public.site_versions(id, site_id, organization_id)
  on delete restrict
  deferrable initially deferred;

create index sites_published_version_id_idx
  on public.sites(published_version_id)
  where published_version_id is not null;

create table public.publish_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null,
  draft_id uuid not null,
  draft_revision integer not null,
  content_hash text not null,
  consequence_hash text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  constraint publish_approvals_draft_tenant_fkey
    foreign key (draft_id, site_id, organization_id)
    references public.site_drafts(id, site_id, organization_id) on delete cascade,
  constraint publish_approvals_draft_revision_positive check (draft_revision > 0),
  constraint publish_approvals_content_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint publish_approvals_consequence_hash_format
    check (consequence_hash ~ '^[0-9a-f]{64}$'),
  constraint publish_approvals_expiry_after_approval check (expires_at > approved_at)
);

create index publish_approvals_organization_id_idx
  on public.publish_approvals(organization_id);
create index publish_approvals_draft_id_idx on public.publish_approvals(draft_id);
create index publish_approvals_approved_by_idx on public.publish_approvals(approved_by);
create unique index publish_approvals_one_active_exact_idx
  on public.publish_approvals(
    approved_by,
    draft_id,
    draft_revision,
    content_hash,
    consequence_hash
  )
  where consumed_at is null;

create table public.publication_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  kind public.publication_operation_kind not null,
  idempotency_key uuid not null,
  request_hash text not null,
  result_version_id uuid not null,
  created_at timestamptz not null default now(),
  constraint publication_operations_result_tenant_fkey
    foreign key (result_version_id, site_id, organization_id)
    references public.site_versions(id, site_id, organization_id) on delete restrict,
  constraint publication_operations_request_hash_format
    check (request_hash ~ '^[0-9a-f]{64}$'),
  unique (organization_id, actor_user_id, kind, idempotency_key)
);

create index publication_operations_site_id_idx
  on public.publication_operations(site_id);
create index publication_operations_result_version_id_idx
  on public.publication_operations(result_version_id);
create index publication_operations_actor_user_id_idx
  on public.publication_operations(actor_user_id);

create function private.site_content_is_valid(p_content jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(p_content) = 'object'
    and p_content ?& array['headline', 'summary', 'opening_hours', 'cta_label']
    and (p_content - array['headline', 'summary', 'opening_hours', 'cta_label']) = '{}'::jsonb
    and jsonb_typeof(p_content -> 'headline') = 'string'
    and length(btrim(p_content ->> 'headline')) between 1 and 100
    and jsonb_typeof(p_content -> 'summary') = 'string'
    and length(btrim(p_content ->> 'summary')) between 1 and 300
    and jsonb_typeof(p_content -> 'cta_label') = 'string'
    and length(btrim(p_content ->> 'cta_label')) between 1 and 40
    and jsonb_typeof(p_content -> 'opening_hours') = 'object'
    and case
      when jsonb_typeof(p_content -> 'opening_hours') = 'object' then
        (select count(*) from jsonb_each(p_content -> 'opening_hours')) between 1 and 7
        and not exists (
          select 1
          from jsonb_each(p_content -> 'opening_hours') as hours(label, value)
          where hours.label !~ '^[a-z][a-z0-9_]{0,31}$'
            or jsonb_typeof(hours.value) <> 'string'
            or length(btrim(hours.value #>> '{}')) not between 1 and 40
        )
      else false
    end;
$$;

create function private.site_content_hash(p_content jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_content::text, 'sha256'), 'hex');
$$;

revoke all on function private.site_content_is_valid(jsonb) from public;
revoke all on function private.site_content_hash(jsonb) from public;
grant execute on function private.site_content_is_valid(jsonb) to service_role;

alter table public.site_drafts
  add constraint site_drafts_content_contract
  check (private.site_content_is_valid(content));
alter table public.site_versions
  add constraint site_versions_content_contract
  check (private.site_content_is_valid(content));

create function private.reject_site_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'site_versions_are_immutable';
end;
$$;

revoke all on function private.reject_site_version_update() from public;

create trigger site_versions_reject_update
before update on public.site_versions
for each row execute function private.reject_site_version_update();

alter table public.sites enable row level security;
alter table public.site_drafts enable row level security;
alter table public.site_versions enable row level security;
alter table public.publish_approvals enable row level security;
alter table public.publication_operations enable row level security;

create policy "Members can read organization sites"
on public.sites for select to authenticated
using ((select private.has_organization_role(organization_id)));
create policy "Members can read organization drafts"
on public.site_drafts for select to authenticated
using ((select private.has_organization_role(organization_id)));
create policy "Members can read organization versions"
on public.site_versions for select to authenticated
using ((select private.has_organization_role(organization_id)));
create policy "Owners can read exact approvals"
on public.publish_approvals for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner'::public.organization_role]
)));
create policy "Owners can read publication operations"
on public.publication_operations for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner'::public.organization_role]
)));

create function public.create_or_patch_site_draft(
  p_site_id uuid,
  p_expected_revision integer,
  p_content jsonb
)
returns public.site_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_site public.sites%rowtype;
  v_draft public.site_drafts%rowtype;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select * into v_site from public.sites where id = p_site_id for update;

  if v_site.id is null or not private.has_organization_role(v_site.organization_id) then
    raise insufficient_privilege using message = 'site_unavailable';
  end if;

  if not private.site_content_is_valid(p_content) then
    raise exception using errcode = '22023', message = 'invalid_site_content';
  end if;

  select * into v_draft from public.site_drafts where site_id = p_site_id for update;

  if v_draft.id is null then
    if p_expected_revision <> 0 then
      raise exception using errcode = 'PT409', message = 'revision_conflict';
    end if;

    insert into public.site_drafts (
      organization_id,
      site_id,
      content,
      updated_by
    ) values (
      v_site.organization_id,
      p_site_id,
      p_content,
      v_actor_user_id
    ) returning * into v_draft;
  else
    if v_draft.revision <> p_expected_revision then
      raise exception using errcode = 'PT409', message = 'revision_conflict';
    end if;

    update public.site_drafts
    set
      content = p_content,
      revision = revision + 1,
      updated_by = v_actor_user_id,
      updated_at = now()
    where id = v_draft.id
    returning * into v_draft;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_site.organization_id,
    v_actor_user_id,
    'site_draft.saved',
    'site_draft',
    v_draft.id,
    jsonb_build_object('revision', v_draft.revision)
  );

  return v_draft;
end;
$$;

create function public.preview_publish_consequences(p_draft_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_draft public.site_drafts%rowtype;
  v_site_slug text;
  v_content_hash text;
  v_consequence_hash text;
begin
  select *
  into v_draft
  from public.site_drafts as draft
  where draft.id = p_draft_id;

  if v_draft.id is null or not private.has_organization_role(v_draft.organization_id) then
    raise insufficient_privilege using message = 'draft_unavailable';
  end if;

  select site.slug
  into v_site_slug
  from public.sites as site
  where site.id = v_draft.site_id;

  v_content_hash := private.site_content_hash(v_draft.content);
  v_consequence_hash := encode(
    extensions.digest(
      concat_ws('|', v_draft.site_id, v_draft.revision, v_content_hash),
      'sha256'
    ),
    'hex'
  );

  return jsonb_build_object(
    'site_id', v_draft.site_id,
    'site_slug', v_site_slug,
    'draft_id', v_draft.id,
    'draft_revision', v_draft.revision,
    'content_hash', v_content_hash,
    'consequence_hash', v_consequence_hash,
    'human_surface', jsonb_build_object('route', '/' || v_site_slug),
    'agent_surface', jsonb_build_object('published_tools', jsonb_build_array('get_opening_hours')),
    'content', v_draft.content
  );
end;
$$;

create function public.approve_site_draft(
  p_draft_id uuid,
  p_expected_revision integer,
  p_consequence_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_draft public.site_drafts%rowtype;
  v_preview jsonb;
  v_approval_id uuid;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select * into v_draft from public.site_drafts where id = p_draft_id;

  if v_draft.id is null or not private.has_organization_role(
    v_draft.organization_id,
    array['owner'::public.organization_role]
  ) then
    raise insufficient_privilege using message = 'owner_approval_required';
  end if;

  if v_draft.revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'revision_conflict';
  end if;

  v_preview := public.preview_publish_consequences(p_draft_id);

  if v_preview ->> 'consequence_hash' <> p_consequence_hash then
    raise exception using errcode = '22023', message = 'consequence_hash_mismatch';
  end if;

  insert into public.publish_approvals (
    organization_id,
    site_id,
    draft_id,
    draft_revision,
    content_hash,
    consequence_hash,
    approved_by
  ) values (
    v_draft.organization_id,
    v_draft.site_id,
    v_draft.id,
    v_draft.revision,
    v_preview ->> 'content_hash',
    p_consequence_hash,
    v_actor_user_id
  )
  on conflict (
    approved_by,
    draft_id,
    draft_revision,
    content_hash,
    consequence_hash
  ) where consumed_at is null
  do update set expires_at = now() + interval '10 minutes'
  returning id into v_approval_id;

  return v_approval_id;
end;
$$;

create function public.publish_site_draft(
  p_draft_id uuid,
  p_expected_revision integer,
  p_approval_id uuid,
  p_consequence_hash text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_draft public.site_drafts%rowtype;
  v_approval public.publish_approvals%rowtype;
  v_existing_operation public.publication_operations%rowtype;
  v_content_hash text;
  v_request_hash text;
  v_version_id uuid;
  v_version_number integer;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select * into v_draft from public.site_drafts where id = p_draft_id;

  if v_draft.id is null or not private.has_organization_role(
    v_draft.organization_id,
    array['owner'::public.organization_role]
  ) then
    raise insufficient_privilege using message = 'owner_publish_required';
  end if;

  perform 1 from public.sites where id = v_draft.site_id for update;
  select * into v_draft from public.site_drafts where id = p_draft_id for update;

  v_request_hash := encode(
    extensions.digest(
      concat_ws(
        '|',
        'publish',
        p_draft_id,
        p_expected_revision,
        p_approval_id,
        p_consequence_hash
      ),
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing_operation
  from public.publication_operations as operation
  where operation.organization_id = v_draft.organization_id
    and operation.actor_user_id = v_actor_user_id
    and operation.kind = 'publish'
    and operation.idempotency_key = p_idempotency_key;

  if v_existing_operation.id is not null then
    if v_existing_operation.request_hash <> v_request_hash then
      raise exception using
        errcode = '22023',
        message = 'idempotency_key_reused_for_different_publication';
    end if;

    return v_existing_operation.result_version_id;
  end if;

  select * into v_approval
  from public.publish_approvals
  where id = p_approval_id
  for update;

  v_content_hash := private.site_content_hash(v_draft.content);

  if v_draft.revision <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'revision_conflict';
  end if;

  if v_approval.id is null
    or v_approval.approved_by <> v_actor_user_id
    or v_approval.organization_id <> v_draft.organization_id
    or v_approval.site_id <> v_draft.site_id
    or v_approval.draft_id <> v_draft.id
    or v_approval.draft_revision <> v_draft.revision
    or v_approval.content_hash <> v_content_hash
    or v_approval.consequence_hash <> p_consequence_hash
    or v_approval.consumed_at is not null
    or v_approval.expires_at <= now() then
    raise exception using errcode = '22023', message = 'approval_invalid_or_expired';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.site_versions
  where site_id = v_draft.site_id;

  insert into public.site_versions (
    organization_id,
    site_id,
    version_number,
    source_draft_id,
    source_draft_revision,
    content,
    content_hash,
    published_by
  ) values (
    v_draft.organization_id,
    v_draft.site_id,
    v_version_number,
    v_draft.id,
    v_draft.revision,
    v_draft.content,
    v_content_hash,
    v_actor_user_id
  ) returning id into v_version_id;

  update public.sites
  set published_version_id = v_version_id
  where id = v_draft.site_id;

  update public.publish_approvals
  set consumed_at = now()
  where id = v_approval.id;

  insert into public.publication_operations (
    organization_id,
    site_id,
    actor_user_id,
    kind,
    idempotency_key,
    request_hash,
    result_version_id
  ) values (
    v_draft.organization_id,
    v_draft.site_id,
    v_actor_user_id,
    'publish',
    p_idempotency_key,
    v_request_hash,
    v_version_id
  );

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_draft.organization_id,
    v_actor_user_id,
    'site_version.published',
    'site_version',
    v_version_id,
    jsonb_build_object(
      'draft_id', v_draft.id,
      'draft_revision', v_draft.revision,
      'content_hash', v_content_hash
    )
  );

  return v_version_id;
end;
$$;

create function public.rollback_site_version(
  p_site_id uuid,
  p_target_version_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_site public.sites%rowtype;
  v_target public.site_versions%rowtype;
  v_existing_operation public.publication_operations%rowtype;
  v_request_hash text;
  v_version_id uuid;
  v_version_number integer;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select * into v_site from public.sites where id = p_site_id for update;

  if v_site.id is null or not private.has_organization_role(
    v_site.organization_id,
    array['owner'::public.organization_role]
  ) then
    raise insufficient_privilege using message = 'owner_rollback_required';
  end if;

  v_request_hash := encode(
    extensions.digest(
      concat_ws('|', 'rollback', p_site_id, p_target_version_id),
      'sha256'
    ),
    'hex'
  );

  select *
  into v_existing_operation
  from public.publication_operations as operation
  where operation.organization_id = v_site.organization_id
    and operation.actor_user_id = v_actor_user_id
    and operation.kind = 'rollback'
    and operation.idempotency_key = p_idempotency_key;

  if v_existing_operation.id is not null then
    if v_existing_operation.request_hash <> v_request_hash then
      raise exception using
        errcode = '22023',
        message = 'idempotency_key_reused_for_different_rollback';
    end if;

    return v_existing_operation.result_version_id;
  end if;

  select * into v_target
  from public.site_versions
  where id = p_target_version_id and site_id = p_site_id;

  if v_target.id is null then
    raise exception using errcode = '22023', message = 'target_version_unavailable';
  end if;

  if v_site.published_version_id = v_target.id then
    raise exception using errcode = '22023', message = 'target_version_already_published';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.site_versions
  where site_id = p_site_id;

  insert into public.site_versions (
    organization_id,
    site_id,
    version_number,
    source_draft_id,
    source_draft_revision,
    content,
    content_hash,
    published_by
  ) values (
    v_site.organization_id,
    p_site_id,
    v_version_number,
    v_target.source_draft_id,
    v_target.source_draft_revision,
    v_target.content,
    v_target.content_hash,
    v_actor_user_id
  ) returning id into v_version_id;

  update public.sites set published_version_id = v_version_id where id = p_site_id;

  insert into public.publication_operations (
    organization_id,
    site_id,
    actor_user_id,
    kind,
    idempotency_key,
    request_hash,
    result_version_id
  ) values (
    v_site.organization_id,
    p_site_id,
    v_actor_user_id,
    'rollback',
    p_idempotency_key,
    v_request_hash,
    v_version_id
  );

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_site.organization_id,
    v_actor_user_id,
    'site_version.rolled_back',
    'site_version',
    v_version_id,
    jsonb_build_object('restored_version_id', p_target_version_id)
  );

  return v_version_id;
end;
$$;

create function public.get_published_site(p_slug text)
returns table (
  site_slug text,
  version_id uuid,
  version_number integer,
  content jsonb,
  content_hash text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    site.slug,
    version.id,
    version.version_number,
    version.content,
    version.content_hash,
    version.published_at
  from public.sites as site
  join public.site_versions as version on version.id = site.published_version_id
  where site.slug = p_slug;
$$;

revoke all on table public.sites from anon, authenticated;
revoke all on table public.site_drafts from anon, authenticated;
revoke all on table public.site_versions from anon, authenticated;
revoke all on table public.publish_approvals from anon, authenticated;
revoke all on table public.publication_operations from anon, authenticated;

grant select on table public.sites to authenticated;
grant select on table public.site_drafts to authenticated;
grant select on table public.site_versions to authenticated;
grant select on table public.publish_approvals to authenticated;
grant select on table public.publication_operations to authenticated;

grant all on table public.sites to service_role;
grant all on table public.site_drafts to service_role;
grant all on table public.site_versions to service_role;
grant all on table public.publish_approvals to service_role;
grant all on table public.publication_operations to service_role;

revoke all on function public.create_or_patch_site_draft(uuid, integer, jsonb) from public;
revoke all on function public.preview_publish_consequences(uuid) from public;
revoke all on function public.approve_site_draft(uuid, integer, text) from public;
revoke all on function public.publish_site_draft(uuid, integer, uuid, text, uuid) from public;
revoke all on function public.rollback_site_version(uuid, uuid, uuid) from public;
revoke all on function public.get_published_site(text) from public;

grant execute on function public.create_or_patch_site_draft(uuid, integer, jsonb)
  to authenticated;
grant execute on function public.preview_publish_consequences(uuid)
  to authenticated;
grant execute on function public.approve_site_draft(uuid, integer, text)
  to authenticated;
grant execute on function public.publish_site_draft(uuid, integer, uuid, text, uuid)
  to authenticated;
grant execute on function public.rollback_site_version(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.get_published_site(text) to anon, authenticated;

comment on table public.site_versions is
  'Immutable canonical snapshots used by both the human page and public WebMCP tools.';
comment on table public.publish_approvals is
  'Short-lived one-shot owner approvals bound to an exact draft and consequence hash.';
