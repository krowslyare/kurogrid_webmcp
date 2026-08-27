create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.organization_role as enum ('owner', 'member');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  constraint organizations_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_name_not_blank
    check (length(btrim(name)) between 1 and 120)
);

create table public.organization_memberships (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_action_not_blank
    check (length(btrim(action)) between 1 and 100),
  constraint audit_events_target_type_not_blank
    check (length(btrim(target_type)) between 1 and 100),
  constraint audit_events_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_organization_created_at_idx
  on public.audit_events(organization_id, created_at desc);

create function private.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_memberships as membership
      where membership.organization_id = p_organization_id
        and membership.user_id = (select auth.uid())
        and (p_roles is null or membership.role = any (p_roles))
    );
$$;

revoke all on function private.has_organization_role(uuid, public.organization_role[])
  from public;
grant execute on function private.has_organization_role(uuid, public.organization_role[])
  to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_events enable row level security;

create policy "Members can read their organizations"
on public.organizations
for select
to authenticated
using (private.has_organization_role(id));

create policy "Users read their membership and owners read the organization roster"
on public.organization_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_organization_role(
    organization_id,
    array['owner'::public.organization_role]
  )
);

create policy "Owners can read audit events in their organizations"
on public.audit_events
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array['owner'::public.organization_role]
  )
);

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.audit_events to authenticated;

grant all on table public.organizations to service_role;
grant all on table public.organization_memberships to service_role;
grant select, insert on table public.audit_events to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public;

comment on schema private is
  'Unexposed helpers used by RLS and privileged server operations.';
comment on table public.organizations is
  'Tenant boundary for every authenticated business resource.';
comment on table public.organization_memberships is
  'Authoritative user-to-organization role assignments.';
comment on table public.audit_events is
  'Append-only within a tenant lifecycle; records security-sensitive operations.';
