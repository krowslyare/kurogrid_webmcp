create type public.attention_kind as enum (
  'synthetic_lead',
  'analytics_snapshot',
  'verified_fact'
);

create type public.attention_status as enum ('open', 'acknowledged');

create type public.action_plan_step_kind as enum (
  'acknowledge_attention',
  'draft_site_update',
  'review_publication'
);

create table public.attention_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  kind public.attention_kind not null,
  title text not null,
  summary text not null,
  evidence jsonb not null,
  status public.attention_status not null default 'open',
  revision integer not null default 1,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint attention_items_title_not_blank
    check (length(btrim(title)) between 1 and 120),
  constraint attention_items_summary_not_blank
    check (length(btrim(summary)) between 1 and 500),
  constraint attention_items_evidence_is_object
    check (jsonb_typeof(evidence) = 'object'),
  constraint attention_items_revision_positive check (revision > 0),
  constraint attention_items_acknowledgement_consistent check (
    (status = 'open' and acknowledged_by is null and acknowledged_at is null)
    or
    (status = 'acknowledged' and acknowledged_by is not null and acknowledged_at is not null)
  )
);

create index attention_items_organization_status_created_at_idx
  on public.attention_items(organization_id, status, created_at desc);
create index attention_items_acknowledged_by_idx
  on public.attention_items(acknowledged_by)
  where acknowledged_by is not null;

create table public.action_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  attention_item_id uuid not null unique
    references public.attention_items(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, created_by, idempotency_key)
);

create index action_plans_organization_created_at_idx
  on public.action_plans(organization_id, created_at desc);
create index action_plans_created_by_idx on public.action_plans(created_by);

create table public.action_plan_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  action_plan_id uuid not null
    references public.action_plans(id) on delete cascade,
  position smallint not null,
  kind public.action_plan_step_kind not null,
  title text not null,
  created_at timestamptz not null default now(),
  constraint action_plan_steps_position_fixed check (position between 1 and 3),
  constraint action_plan_steps_title_not_blank
    check (length(btrim(title)) between 1 and 120),
  unique (action_plan_id, position),
  unique (action_plan_id, kind)
);

create index action_plan_steps_organization_idx
  on public.action_plan_steps(organization_id);
create index action_plan_steps_plan_position_idx
  on public.action_plan_steps(action_plan_id, position);

alter table public.attention_items enable row level security;
alter table public.action_plans enable row level security;
alter table public.action_plan_steps enable row level security;

create policy "Members can read organization attention"
on public.attention_items
for select
to authenticated
using ((select private.has_organization_role(organization_id)));

create policy "Members can read organization action plans"
on public.action_plans
for select
to authenticated
using ((select private.has_organization_role(organization_id)));

create policy "Members can read organization action plan steps"
on public.action_plan_steps
for select
to authenticated
using ((select private.has_organization_role(organization_id)));

create function public.create_action_plan(
  p_attention_item_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_existing_attention_item_id uuid;
  v_plan_id uuid;
  v_created boolean := false;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select item.organization_id
  into v_organization_id
  from public.attention_items as item
  where item.id = p_attention_item_id;

  if v_organization_id is null
    or not private.has_organization_role(v_organization_id) then
    raise insufficient_privilege using message = 'attention_item_unavailable';
  end if;

  select plan.id, plan.attention_item_id
  into v_plan_id, v_existing_attention_item_id
  from public.action_plans as plan
  where plan.organization_id = v_organization_id
    and plan.created_by = v_actor_user_id
    and plan.idempotency_key = p_idempotency_key;

  if v_plan_id is not null and v_existing_attention_item_id <> p_attention_item_id then
    raise exception using
      errcode = '22023',
      message = 'idempotency_key_reused_for_different_attention_item';
  end if;

  if v_plan_id is null then
    insert into public.action_plans (
      organization_id,
      attention_item_id,
      created_by,
      idempotency_key
    ) values (
      v_organization_id,
      p_attention_item_id,
      v_actor_user_id,
      p_idempotency_key
    )
    on conflict (attention_item_id) do nothing
    returning id into v_plan_id;

    if v_plan_id is null then
      select plan.id
      into v_plan_id
      from public.action_plans as plan
      where plan.attention_item_id = p_attention_item_id;
    else
      v_created := true;
    end if;
  end if;

  if v_created then
    insert into public.action_plan_steps (
      organization_id,
      action_plan_id,
      position,
      kind,
      title
    ) values
      (
        v_organization_id,
        v_plan_id,
        1,
        'acknowledge_attention',
        'Acknowledge the opportunity'
      ),
      (
        v_organization_id,
        v_plan_id,
        2,
        'draft_site_update',
        'Prepare a structured site draft'
      ),
      (
        v_organization_id,
        v_plan_id,
        3,
        'review_publication',
        'Review consequences before publishing'
      );

    insert into public.audit_events (
      organization_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      v_organization_id,
      v_actor_user_id,
      'action_plan.created',
      'action_plan',
      v_plan_id,
      jsonb_build_object('attention_item_id', p_attention_item_id)
    );
  end if;

  return v_plan_id;
end;
$$;

create function public.acknowledge_lead_attention(
  p_attention_item_id uuid,
  p_expected_revision integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_item public.attention_items%rowtype;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select *
  into v_item
  from public.attention_items as item
  where item.id = p_attention_item_id
  for update;

  if v_item.id is null
    or v_item.kind <> 'synthetic_lead'
    or not private.has_organization_role(v_item.organization_id) then
    raise insufficient_privilege using message = 'lead_attention_unavailable';
  end if;

  if v_item.status = 'acknowledged' then
    return v_item.revision;
  end if;

  if v_item.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  update public.attention_items
  set
    status = 'acknowledged',
    revision = revision + 1,
    acknowledged_by = v_actor_user_id,
    acknowledged_at = now()
  where id = p_attention_item_id
  returning revision into v_item.revision;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_item.organization_id,
    v_actor_user_id,
    'attention.acknowledged',
    'attention_item',
    p_attention_item_id,
    jsonb_build_object('previous_revision', p_expected_revision)
  );

  return v_item.revision;
end;
$$;

revoke all on table public.attention_items from anon, authenticated;
revoke all on table public.action_plans from anon, authenticated;
revoke all on table public.action_plan_steps from anon, authenticated;

grant select on table public.attention_items to authenticated;
grant select on table public.action_plans to authenticated;
grant select on table public.action_plan_steps to authenticated;

grant all on table public.attention_items to service_role;
grant all on table public.action_plans to service_role;
grant all on table public.action_plan_steps to service_role;

revoke all on function public.create_action_plan(uuid, uuid) from public;
revoke all on function public.acknowledge_lead_attention(uuid, integer) from public;
grant execute on function public.create_action_plan(uuid, uuid) to authenticated;
grant execute on function public.acknowledge_lead_attention(uuid, integer)
  to authenticated;

comment on table public.attention_items is
  'Synthetic, non-PII evidence signals used to demonstrate cross-module planning.';
comment on table public.action_plans is
  'One evidence-bound plan per attention item; deliberately not a workflow engine.';
comment on table public.action_plan_steps is
  'The fixed three-step demonstration contract for every action plan.';
comment on function public.acknowledge_lead_attention(uuid, integer) is
  'Records acknowledgement only. It never contacts a lead or invokes a provider.';
