create table public.demo_runtime_config (
  singleton boolean primary key default true check (singleton),
  capacity smallint not null default 2 check (capacity between 2 and 64),
  lease_minutes smallint not null default 30 check (lease_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);

insert into public.demo_runtime_config (singleton, capacity, lease_minutes)
values (true, 2, 30);

create table public.demo_sandboxes (
  id uuid primary key default gen_random_uuid(),
  slot_number smallint not null unique check (slot_number > 0),
  organization_id uuid not null unique
    references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint demo_sandboxes_distinct_roles
    check (owner_user_id <> member_user_id)
);

create index demo_sandboxes_owner_user_id_idx on public.demo_sandboxes(owner_user_id);
create index demo_sandboxes_member_user_id_idx on public.demo_sandboxes(member_user_id);

create table public.demo_leases (
  id uuid primary key default gen_random_uuid(),
  sandbox_id uuid not null references public.demo_sandboxes(id) on delete cascade,
  lease_token_hash text not null unique,
  requested_role public.organization_role not null,
  leased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  constraint demo_leases_token_hash_format
    check (lease_token_hash ~ '^[0-9a-f]{64}$'),
  constraint demo_leases_expiry_after_start check (expires_at > leased_at),
  constraint demo_leases_release_after_start
    check (released_at is null or released_at >= leased_at)
);

create unique index demo_leases_one_active_per_sandbox_idx
  on public.demo_leases(sandbox_id)
  where released_at is null;
create index demo_leases_expiry_idx
  on public.demo_leases(expires_at)
  where released_at is null;

alter table public.demo_runtime_config enable row level security;
alter table public.demo_sandboxes enable row level security;
alter table public.demo_leases enable row level security;

create function private.reset_demo_sandbox(p_sandbox_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sandbox public.demo_sandboxes%rowtype;
  v_site_id uuid;
begin
  select * into v_sandbox
  from public.demo_sandboxes
  where id = p_sandbox_id;

  if v_sandbox.id is null then
    raise exception using errcode = '22023', message = 'sandbox_unavailable';
  end if;

  select id into v_site_id
  from public.sites
  where organization_id = v_sandbox.organization_id
  order by created_at
  limit 1;

  if v_site_id is not null then
    update public.sites set published_version_id = null where id = v_site_id;
    delete from public.publication_operations where site_id = v_site_id;
    delete from public.publish_approvals where site_id = v_site_id;
    delete from public.site_versions where site_id = v_site_id;
    delete from public.site_drafts where site_id = v_site_id;
  end if;

  delete from public.action_plan_steps
  where organization_id = v_sandbox.organization_id;
  delete from public.action_plans
  where organization_id = v_sandbox.organization_id;
  delete from public.attention_items
  where organization_id = v_sandbox.organization_id;
  delete from public.audit_events
  where organization_id = v_sandbox.organization_id;

  insert into public.attention_items (
    organization_id,
    kind,
    title,
    summary,
    evidence
  ) values
    (
      v_sandbox.organization_id,
      'synthetic_lead',
      'Weekend inquiry needs attention',
      'A fictional pet owner asked about Saturday availability outside the published hours.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'inquiry_type', 'weekend_availability',
        'contains_pii', false
      )
    ),
    (
      v_sandbox.organization_id,
      'analytics_snapshot',
      'Weekend intent is visible in the sample',
      'The fictional seven-day snapshot shows stronger interest in weekend availability.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'period', '7d',
        'weekend_interest_count', 18,
        'weekday_interest_count', 9
      )
    ),
    (
      v_sandbox.organization_id,
      'verified_fact',
      'Saturday coverage is approved',
      'The fictional business fact allows Saturday hours from 09:00 to 14:00.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'fact', 'saturday_hours',
        'value', '09:00–14:00',
        'verified', true
      )
    );
end;
$$;

create function public.claim_demo_sandbox(
  p_lease_token_hash text,
  p_requested_role public.organization_role
)
returns table (
  lease_id uuid,
  slot_number smallint,
  organization_slug text,
  user_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity smallint;
  v_lease_minutes smallint;
  v_sandbox public.demo_sandboxes%rowtype;
  v_user_id uuid;
begin
  if p_lease_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_lease_token_hash';
  end if;

  select config.capacity, config.lease_minutes
  into v_capacity, v_lease_minutes
  from public.demo_runtime_config as config
  where config.singleton;

  update public.demo_leases as expired_lease
  set released_at = now()
  where expired_lease.released_at is null
    and expired_lease.expires_at <= now();

  select sandbox.*
  into v_sandbox
  from public.demo_sandboxes as sandbox
  where sandbox.enabled
    and sandbox.slot_number <= v_capacity
    and not exists (
      select 1
      from public.demo_leases as lease
      where lease.sandbox_id = sandbox.id
        and lease.released_at is null
    )
  order by sandbox.slot_number
  for update skip locked
  limit 1;

  if v_sandbox.id is null then
    raise exception using errcode = 'P0001', message = 'demo_capacity_exhausted';
  end if;

  perform private.reset_demo_sandbox(v_sandbox.id);

  v_user_id := case p_requested_role
    when 'owner' then v_sandbox.owner_user_id
    else v_sandbox.member_user_id
  end;

  return query
  with inserted_lease as (
    insert into public.demo_leases (
      sandbox_id,
      lease_token_hash,
      requested_role,
      expires_at
    ) values (
      v_sandbox.id,
      p_lease_token_hash,
      p_requested_role,
      now() + make_interval(mins => v_lease_minutes)
    )
    returning demo_leases.id, demo_leases.expires_at
  )
  select
    inserted_lease.id,
    v_sandbox.slot_number,
    organization.slug,
    user_record.email::text,
    inserted_lease.expires_at
  from inserted_lease
  join public.organizations as organization
    on organization.id = v_sandbox.organization_id
  join auth.users as user_record on user_record.id = v_user_id;
end;
$$;

create function public.release_demo_sandbox(p_lease_token_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with released as (
    update public.demo_leases
    set released_at = now()
    where lease_token_hash = p_lease_token_hash
      and released_at is null
    returning id
  )
  select exists(select 1 from released);
$$;

revoke all on table public.demo_runtime_config from anon, authenticated;
revoke all on table public.demo_sandboxes from anon, authenticated;
revoke all on table public.demo_leases from anon, authenticated;
grant all on table public.demo_runtime_config to service_role;
grant all on table public.demo_sandboxes to service_role;
grant all on table public.demo_leases to service_role;

revoke all on function private.reset_demo_sandbox(uuid) from public;
revoke all on function public.claim_demo_sandbox(text, public.organization_role) from public;
revoke all on function public.release_demo_sandbox(text) from public;
grant execute on function public.claim_demo_sandbox(text, public.organization_role)
  to service_role;
grant execute on function public.release_demo_sandbox(text) to service_role;

comment on table public.demo_runtime_config is
  'Submission-time pool capacity. The enforced minimum is two isolated slots.';
comment on function public.claim_demo_sandbox(text, public.organization_role) is
  'Service-only atomic lease allocation with SKIP LOCKED and a clean synthetic reset.';
