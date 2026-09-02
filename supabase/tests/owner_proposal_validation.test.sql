-- Owner proposals must resolve to a real, currently available slot. A plan's
-- busy intervals and confirmed bookings both leave slots unavailable, so one
-- rule protects the exact-plan promise from every direction.

begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_function(
  'public',
  'owner_update_appointment_request',
  array['uuid', 'text', 'timestamptz'],
  'owner appointment decision RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.owner_update_appointment_request(uuid,text,timestamptz)',
    'execute'
  ),
  'authenticated can reach the Owner-guarded proposal RPC'
);

create temporary table proposal_test_context (
  organization_id uuid not null,
  site_id uuid not null,
  service_id uuid not null,
  owner_id uuid not null,
  next_saturday date not null,
  today date not null
) on commit drop;

insert into proposal_test_context (
  organization_id,
  site_id,
  service_id,
  owner_id,
  next_saturday,
  today
)
select
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999999',
  '55555555-5555-4555-8555-555555555555',
  today + case
    when 6 - extract(isodow from today)::integer <= 0
      then 13 - extract(isodow from today)::integer
    else 6 - extract(isodow from today)::integer
  end,
  today
from (
  select (now() at time zone 'America/Lima')::date as today
) as current_day;

grant select on proposal_test_context to authenticated, anon;

insert into auth.users (id, email)
values
  (
    '55555555-5555-4555-8555-555555555555',
    'owner-proposal@example.test'
  );

insert into public.organizations (id, slug, name)
values
  (
    '77777777-7777-4777-8777-777777777777',
    'proposal-guard',
    'Proposal Guard'
  );

insert into public.organization_memberships (
  organization_id,
  user_id,
  role
)
values
  (
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555',
    'owner'
  );

insert into public.sites (id, organization_id, slug)
values
  (
    '88888888-8888-4888-8888-888888888888',
    '77777777-7777-4777-8777-777777777777',
    'proposal-guard-site'
  );

insert into public.clinic_services (
  id,
  organization_id,
  site_id,
  slug,
  name,
  description,
  duration_minutes
)
values
  (
    '99999999-9999-4999-8999-999999999999',
    '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888',
    'dermatology',
    'Dermatology consultation',
    'Focused skin and allergy care.',
    30
  );

-- Saturday grid:
--   09:30 held by the request under test, 10:30 disabled like a plan busy
--   range, 11:00 taken by a confirmed booking, 11:30 the only valid proposal.
insert into public.appointment_slots (
  organization_id,
  site_id,
  service_id,
  starts_at,
  available
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  (context.next_saturday + slot.start_time) at time zone 'America/Lima',
  slot.available
from proposal_test_context as context
cross join (values
  (time '09:00', true),
  (time '09:30', false),
  (time '10:30', false),
  (time '11:00', false),
  (time '11:30', true)
) as slot(start_time, available);

-- One slot in the past that is technically open, to prove the time check
-- fires before the slot lookup.
insert into public.appointment_slots (
  organization_id,
  site_id,
  service_id,
  starts_at,
  available
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  (context.today - 1 + time '09:00') at time zone 'America/Lima',
  true
from proposal_test_context as context;

with inserted as (
  insert into public.appointment_requests (
    organization_id,
    site_id,
    service_id,
    slot_id,
    pet_name,
    customer_email,
    status,
    idempotency_key
  )
  select
    slot.organization_id,
    slot.site_id,
    slot.service_id,
    slot.id,
    booking.pet_name,
    booking.customer_email,
    booking.status,
    booking.idempotency_key
  from public.appointment_slots as slot
  join proposal_test_context as context on context.site_id = slot.site_id
  join lateral (values
    (
      'Rocky'::text,
      'rocky@example.test'::text,
      'requested'::public.appointment_request_status,
      '77000000-0000-4000-8000-000000000001'::uuid
    ),
    (
      'Max'::text,
      'max@example.test'::text,
      'confirmed'::public.appointment_request_status,
      '77000000-0000-4000-8000-000000000002'::uuid
    )
  ) as booking(pet_name, customer_email, status, idempotency_key)
    on (slot.starts_at at time zone 'America/Lima')::time
      = case booking.pet_name when 'Rocky' then time '09:30' else time '11:00' end
  returning *
)
select is(
  count(*),
  2::bigint,
  'fixture requests landed on their slots'
)
from inserted;

set local role authenticated;
set local request.jwt.claim.sub =
  '55555555-5555-4555-8555-555555555555';

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select (context.next_saturday + time '10:45') at time zone 'America/Lima'
     from proposal_test_context as context)
  )$$,
  '22023',
  'appointment_proposal_slot_unavailable',
  'a proposal with no slot row is rejected'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select (context.next_saturday + time '10:30') at time zone 'America/Lima'
     from proposal_test_context as context)
  )$$,
  '22023',
  'appointment_proposal_slot_unavailable',
  'a proposal over a plan-disabled busy slot is rejected'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select (context.next_saturday + time '11:00') at time zone 'America/Lima'
     from proposal_test_context as context)
  )$$,
  '22023',
  'appointment_proposal_slot_unavailable',
  'a proposal over a confirmed booking is rejected'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select slot.starts_at
     from public.appointment_slots as slot
     join proposal_test_context as context on context.site_id = slot.site_id
     where (slot.starts_at at time zone 'America/Lima')::time = time '09:30')
  )$$,
  '22023',
  'appointment_proposal_slot_unavailable',
  're-proposing the held requested time is rejected'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select slot.starts_at
     from public.appointment_slots as slot
     join proposal_test_context as context on context.site_id = slot.site_id
     where slot.starts_at < now()
     limit 1)
  )$$,
  '22023',
  'appointment_proposal_time_invalid',
  'a proposal in the past is rejected before the slot lookup'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    null
  )$$,
  '22023',
  'appointment_proposal_time_invalid',
  'a proposal without a time is rejected'
);

select lives_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select (context.next_saturday + time '11:30') at time zone 'America/Lima'
     from proposal_test_context as context)
  )$$,
  'the nearest later available slot is proposable'
);

select is(
  (select status from public.appointment_requests where pet_name = 'Rocky'),
  'time_proposed'::public.appointment_request_status,
  'the request moves to time_proposed'
);

select is(
  (select available
   from public.appointment_slots as slot
   join proposal_test_context as context on context.site_id = slot.site_id
   where (slot.starts_at at time zone 'America/Lima')::time = time '11:30'),
  false,
  'the proposed alternative is held before the customer responds'
);

select results_eq(
  $$select (slot.starts_at at time zone 'America/Lima')::time
    from public.appointment_requests as request
    join public.appointment_slots as slot on slot.id = (
      select candidate.id
      from public.appointment_slots as candidate
      where candidate.site_id = request.site_id
        and candidate.service_id = request.service_id
        and candidate.starts_at = request.proposed_starts_at
    )
    where request.pet_name = 'Rocky'$$,
  $$values (time '11:30')$$,
  'the persisted proposal names the valid 11:30 slot'
);

select is(
  (select count(*) from public.audit_events),
  1::bigint,
  'the proposal writes one audit record'
);

select throws_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'propose',
    (select (context.next_saturday + time '11:30') at time zone 'America/Lima'
     from proposal_test_context as context)
  )$$,
  '22023',
  'invalid_appointment_decision',
  'a second proposal cannot restart a settled decision'
);

select lives_ok(
  $$select public.owner_update_appointment_request(
    (select id from public.appointment_requests where pet_name = 'Rocky'),
    'confirm'
  )$$,
  'confirm still finalizes a proposed request'
);

select is(
  (select status from public.appointment_requests where pet_name = 'Rocky'),
  'confirmed'::public.appointment_request_status,
  'the confirm branch is unchanged'
);

select * from finish();
rollback;
