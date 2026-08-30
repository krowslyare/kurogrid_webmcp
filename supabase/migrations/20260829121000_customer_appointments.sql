create type public.appointment_request_status as enum (
  'prepared',
  'requested',
  'confirmed',
  'time_proposed',
  'declined',
  'cancelled'
);

create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  slug text not null,
  name text not null,
  description text not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clinic_services_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint clinic_services_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint clinic_services_name_not_blank check (length(btrim(name)) between 1 and 100),
  unique (id, organization_id),
  unique (site_id, slug)
);

create table public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint appointment_slots_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint appointment_slots_service_tenant_fkey
    foreign key (service_id, organization_id)
    references public.clinic_services(id, organization_id) on delete cascade,
  unique (id, organization_id),
  unique (site_id, service_id, starts_at)
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null,
  service_id uuid not null,
  slot_id uuid not null,
  pet_name text not null,
  customer_email text not null,
  status public.appointment_request_status not null default 'prepared',
  access_token uuid not null default gen_random_uuid(),
  confirmation_token uuid not null default gen_random_uuid(),
  idempotency_key uuid not null,
  proposed_starts_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_requests_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint appointment_requests_service_tenant_fkey
    foreign key (service_id, organization_id)
    references public.clinic_services(id, organization_id) on delete restrict,
  constraint appointment_requests_slot_tenant_fkey
    foreign key (slot_id, organization_id)
    references public.appointment_slots(id, organization_id) on delete restrict,
  constraint appointment_requests_pet_name_not_blank
    check (length(btrim(pet_name)) between 1 and 80),
  constraint appointment_requests_email_shape
    check (customer_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  unique (id, organization_id),
  unique (site_id, idempotency_key),
  unique (access_token),
  unique (confirmation_token)
);

create index clinic_services_site_active_idx on public.clinic_services(site_id, active);
create index appointment_slots_site_available_starts_idx
  on public.appointment_slots(site_id, available, starts_at);
create index appointment_requests_organization_created_idx
  on public.appointment_requests(organization_id, created_at desc);

alter table public.clinic_services enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointment_requests enable row level security;

create policy "Members read clinic services"
on public.clinic_services for select to authenticated
using (private.has_organization_role(organization_id));

create policy "Members read appointment slots"
on public.appointment_slots for select to authenticated
using (private.has_organization_role(organization_id));

create policy "Members read appointment requests"
on public.appointment_requests for select to authenticated
using (private.has_organization_role(organization_id));

create function public.get_clinic_services(p_site_slug text)
returns table (
  service_slug text,
  service_name text,
  description text,
  duration_minutes smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select service.slug, service.name, service.description, service.duration_minutes
  from public.sites as site
  join public.clinic_services as service on service.site_id = site.id
  where site.slug = p_site_slug
    and site.published_version_id is not null
    and service.active
  order by service.name;
$$;

create function public.find_appointment_slots(
  p_site_slug text,
  p_service_slug text,
  p_date date
)
returns table (
  slot_id uuid,
  starts_at timestamptz,
  duration_minutes smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select slot.id, slot.starts_at, service.duration_minutes
  from public.sites as site
  join public.clinic_services as service on service.site_id = site.id
  join public.appointment_slots as slot on slot.service_id = service.id
  where site.slug = p_site_slug
    and site.published_version_id is not null
    and service.slug = p_service_slug
    and service.active
    and slot.available
    and slot.starts_at >= now()
    and (slot.starts_at at time zone 'America/Lima')::date = p_date
  order by slot.starts_at
  limit 6;
$$;

create function public.prepare_appointment_request(
  p_site_slug text,
  p_service_slug text,
  p_slot_id uuid,
  p_pet_name text,
  p_customer_email text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.sites%rowtype;
  v_service public.clinic_services%rowtype;
  v_slot public.appointment_slots%rowtype;
  v_request public.appointment_requests%rowtype;
begin
  select * into v_site from public.sites where slug = p_site_slug;
  select * into v_service from public.clinic_services
    where site_id = v_site.id and slug = p_service_slug and active;
  select * into v_slot from public.appointment_slots
    where id = p_slot_id and site_id = v_site.id and service_id = v_service.id and available;

  if v_site.id is null or v_site.published_version_id is null
    or v_service.id is null or v_slot.id is null or v_slot.starts_at < now() then
    raise exception using errcode = '22023', message = 'appointment_option_unavailable';
  end if;

  if length(btrim(p_pet_name)) not between 1 and 80
    or p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'invalid_customer_details';
  end if;

  select * into v_request from public.appointment_requests
  where site_id = v_site.id and idempotency_key = p_idempotency_key;

  if v_request.id is null then
    insert into public.appointment_requests (
      organization_id, site_id, service_id, slot_id, pet_name,
      customer_email, idempotency_key
    ) values (
      v_site.organization_id, v_site.id, v_service.id, v_slot.id,
      btrim(p_pet_name), lower(btrim(p_customer_email)), p_idempotency_key
    ) returning * into v_request;
  end if;

  return jsonb_build_object(
    'request_id', v_request.id,
    'access_token', v_request.access_token,
    'confirmation_token', v_request.confirmation_token,
    'status', v_request.status,
    'pet_name', v_request.pet_name,
    'customer_email', v_request.customer_email,
    'service', v_service.name,
    'starts_at', v_slot.starts_at,
    'duration_minutes', v_service.duration_minutes
  );
end;
$$;

create function public.confirm_appointment_request(
  p_request_id uuid,
  p_confirmation_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_requests%rowtype;
begin
  select * into v_request from public.appointment_requests
  where id = p_request_id and confirmation_token = p_confirmation_token
  for update;

  if v_request.id is null then
    raise insufficient_privilege using message = 'appointment_request_unavailable';
  end if;

  if v_request.status = 'prepared' then
    update public.appointment_slots
      set available = false
      where id = v_request.slot_id and available;
    if not found then
      raise exception using errcode = 'PT409', message = 'appointment_slot_no_longer_available';
    end if;

    update public.appointment_requests
      set status = 'requested', updated_at = now()
      where id = v_request.id
      returning * into v_request;
  elsif v_request.status <> 'requested' then
    raise exception using errcode = '22023', message = 'appointment_request_not_confirmable';
  end if;

  return public.get_appointment_status(v_request.id, v_request.access_token);
end;
$$;

create function public.get_appointment_status(
  p_request_id uuid,
  p_access_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'request_id', request.id,
    'status', request.status,
    'pet_name', request.pet_name,
    'customer_email', request.customer_email,
    'service', service.name,
    'starts_at', coalesce(request.proposed_starts_at, slot.starts_at),
    'original_starts_at', slot.starts_at,
    'proposed_starts_at', request.proposed_starts_at,
    'duration_minutes', service.duration_minutes,
    'site_slug', site.slug,
    'updated_at', request.updated_at
  )
  from public.appointment_requests as request
  join public.clinic_services as service on service.id = request.service_id
  join public.appointment_slots as slot on slot.id = request.slot_id
  join public.sites as site on site.id = request.site_id
  where request.id = p_request_id and request.access_token = p_access_token;
$$;

create function public.respond_to_appointment_proposal(
  p_request_id uuid,
  p_access_token uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_requests%rowtype;
begin
  select * into v_request from public.appointment_requests
  where id = p_request_id and access_token = p_access_token
  for update;

  if v_request.id is null or v_request.status <> 'time_proposed' then
    raise exception using errcode = '22023', message = 'appointment_proposal_unavailable';
  end if;

  update public.appointment_requests
  set status = case when p_accept then 'confirmed'::public.appointment_request_status
                    else 'declined'::public.appointment_request_status end,
      confirmed_at = case when p_accept then now() else null end,
      updated_at = now()
  where id = v_request.id;

  return public.get_appointment_status(v_request.id, v_request.access_token);
end;
$$;

create function public.owner_update_appointment_request(
  p_request_id uuid,
  p_decision text,
  p_proposed_starts_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_requests%rowtype;
begin
  select * into v_request from public.appointment_requests where id = p_request_id for update;

  if v_request.id is null or not private.has_organization_role(
    v_request.organization_id,
    array['owner'::public.organization_role]
  ) then
    raise insufficient_privilege using message = 'appointment_request_unavailable';
  end if;

  if p_decision = 'confirm' and v_request.status in ('requested', 'time_proposed') then
    update public.appointment_requests
      set status = 'confirmed', proposed_starts_at = null,
          confirmed_at = now(), updated_at = now()
      where id = v_request.id;
  elsif p_decision = 'propose' and v_request.status = 'requested'
    and p_proposed_starts_at is not null and p_proposed_starts_at > now() then
    update public.appointment_requests
      set status = 'time_proposed', proposed_starts_at = p_proposed_starts_at,
          updated_at = now()
      where id = v_request.id;
  else
    raise exception using errcode = '22023', message = 'invalid_appointment_decision';
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    v_request.organization_id, (select auth.uid()),
    case when p_decision = 'confirm' then 'appointment.confirmed' else 'appointment.time_proposed' end,
    'appointment_request', v_request.id,
    jsonb_build_object('proposed_starts_at', p_proposed_starts_at)
  );

  select * into v_request from public.appointment_requests where id = p_request_id;
  return public.get_appointment_status(v_request.id, v_request.access_token)
    || jsonb_build_object('access_token', v_request.access_token);
end;
$$;

revoke all on table public.clinic_services from anon, authenticated;
revoke all on table public.appointment_slots from anon, authenticated;
revoke all on table public.appointment_requests from anon, authenticated;
grant select on table public.clinic_services, public.appointment_slots, public.appointment_requests to authenticated;
grant all on table public.clinic_services, public.appointment_slots, public.appointment_requests to service_role;

revoke all on function public.get_clinic_services(text) from public;
revoke all on function public.find_appointment_slots(text, text, date) from public;
revoke all on function public.prepare_appointment_request(text, text, uuid, text, text, uuid) from public;
revoke all on function public.confirm_appointment_request(uuid, uuid) from public;
revoke all on function public.get_appointment_status(uuid, uuid) from public;
revoke all on function public.respond_to_appointment_proposal(uuid, uuid, boolean) from public;
revoke all on function public.owner_update_appointment_request(uuid, text, timestamptz) from public;

grant execute on function public.get_clinic_services(text) to anon, authenticated;
grant execute on function public.find_appointment_slots(text, text, date) to anon, authenticated;
grant execute on function public.prepare_appointment_request(text, text, uuid, text, text, uuid) to anon, authenticated;
grant execute on function public.confirm_appointment_request(uuid, uuid) to anon, authenticated;
grant execute on function public.get_appointment_status(uuid, uuid) to anon, authenticated;
grant execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.owner_update_appointment_request(uuid, text, timestamptz) to authenticated;

comment on table public.appointment_requests is
  'Synthetic customer appointment journey for the public WebMCP challenge demo.';

create or replace function private.reset_demo_sandbox(p_sandbox_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sandbox public.demo_sandboxes%rowtype;
  v_site_id uuid;
  v_initial_content jsonb := jsonb_build_object(
    'headline', 'Care that makes room for Saturday.',
    'summary', 'Thoughtful veterinary consultations, now with selected Saturday appointments.',
    'opening_hours', jsonb_build_object(
      'weekdays', 'Monday–Friday · 08:00–18:00',
      'saturday', 'Saturday · 09:00–14:00'
    ),
    'cta_label', 'Find an appointment'
  );
  v_version_id uuid;
  v_dermatology_id uuid;
  v_next_saturday date;
begin
  select * into v_sandbox from public.demo_sandboxes where id = p_sandbox_id;
  if v_sandbox.id is null then
    raise exception using errcode = '22023', message = 'sandbox_unavailable';
  end if;

  select id into v_site_id from public.sites
  where organization_id = v_sandbox.organization_id order by created_at limit 1;

  if v_site_id is not null then
    delete from public.appointment_requests where site_id = v_site_id;
    delete from public.appointment_slots where site_id = v_site_id;
    delete from public.clinic_services where site_id = v_site_id;
    update public.sites set published_version_id = null where id = v_site_id;
    delete from public.publication_operations where site_id = v_site_id;
    delete from public.publish_approvals where site_id = v_site_id;
    delete from public.site_versions where site_id = v_site_id;
    delete from public.site_drafts where site_id = v_site_id;
  end if;

  delete from public.action_plan_steps where organization_id = v_sandbox.organization_id;
  delete from public.action_plans where organization_id = v_sandbox.organization_id;
  delete from public.attention_items where organization_id = v_sandbox.organization_id;
  delete from public.audit_events where organization_id = v_sandbox.organization_id;

  insert into public.attention_items (organization_id, kind, title, summary, evidence)
  values
    (
      v_sandbox.organization_id,
      'synthetic_lead',
      'Saturday appointment requests need attention',
      'A fictional pet owner requested dermatology care on Saturday morning.',
      jsonb_build_object('source', 'synthetic_fixture', 'contains_pii', false)
    ),
    (
      v_sandbox.organization_id,
      'analytics_snapshot',
      'Weekend demand is growing',
      'The fictional seven-day snapshot shows twice as much weekend appointment intent.',
      jsonb_build_object('source', 'synthetic_fixture', 'period', '7d', 'weekend_interest_count', 18, 'weekday_interest_count', 9)
    ),
    (
      v_sandbox.organization_id,
      'verified_fact',
      'Saturday coverage is approved',
      'The clinic can accept selected Saturday appointments from 09:00 to 14:00.',
      jsonb_build_object('source', 'synthetic_fixture', 'fact', 'saturday_hours', 'value', '09:00–14:00', 'verified', true)
    );

  if v_site_id is not null then
    insert into public.site_versions (
      organization_id, site_id, version_number, source_draft_revision,
      content, content_hash, published_by
    ) values (
      v_sandbox.organization_id, v_site_id, 1, 1,
      v_initial_content, private.site_content_hash(v_initial_content),
      v_sandbox.owner_user_id
    ) returning id into v_version_id;

    update public.sites set published_version_id = v_version_id where id = v_site_id;

    insert into public.clinic_services (
      organization_id, site_id, slug, name, description, duration_minutes
    ) values
      (v_sandbox.organization_id, v_site_id, 'dermatology', 'Dermatology consultation', 'Focused care for skin, coat, ear, and allergy concerns.', 30)
      returning id into v_dermatology_id;

    insert into public.clinic_services (
      organization_id, site_id, slug, name, description, duration_minutes
    ) values
      (v_sandbox.organization_id, v_site_id, 'wellness-exam', 'Wellness exam', 'A calm preventive check-in for every life stage.', 30),
      (v_sandbox.organization_id, v_site_id, 'vaccination-review', 'Vaccination review', 'Review the current schedule and prepare the next recommended step.', 20);

    v_next_saturday := current_date
      + (case when 6 - extract(isodow from current_date)::integer <= 0
              then 13 - extract(isodow from current_date)::integer
              else 6 - extract(isodow from current_date)::integer end);

    insert into public.appointment_slots (
      organization_id, site_id, service_id, starts_at
    ) values
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '09:30') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '10:30') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '11:30') at time zone 'America/Lima');
  end if;
end;
$$;
