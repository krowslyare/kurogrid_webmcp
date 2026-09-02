begin;

create extension if not exists pgtap with schema extensions;
select plan(74);

select has_table(
  'public',
  'clinic_availability_configurations',
  'availability configurations table exists'
);
select has_table(
  'public',
  'availability_plans',
  'availability plans table exists'
);
select has_column(
  'public',
  'clinic_availability_configurations',
  'organization_id',
  'availability configurations carry their tenant'
);
select has_column(
  'public',
  'availability_plans',
  'preview_hash',
  'plans persist the exact derived preview hash'
);

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.clinic_availability_configurations'::regclass),
  'availability configurations have RLS'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.availability_plans'::regclass),
  'availability plans have RLS'
);
select ok(
  not has_table_privilege(
    'anon',
    'public.clinic_availability_configurations',
    'select,insert,update,delete'
  ),
  'anon has no configuration table access'
);
select ok(
  not has_table_privilege(
    'anon',
    'public.availability_plans',
    'select,insert,update,delete'
  ),
  'anon has no plan table access'
);
select ok(
  has_table_privilege(
    'authenticated',
    'public.clinic_availability_configurations',
    'select'
  ),
  'authenticated can read configurations through RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.availability_plans', 'select'),
  'authenticated can read plans through RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.clinic_availability_configurations',
    'insert,update,delete'
  ),
  'authenticated cannot mutate configurations directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.availability_plans',
    'insert,update,delete'
  ),
  'authenticated cannot mutate plans directly'
);

select has_function(
  'public',
  'get_availability_configuration',
  array['uuid', 'uuid'],
  'configuration read RPC exists'
);
select has_function(
  'public',
  'prepare_availability_plan',
  array['uuid', 'uuid', 'jsonb', 'uuid'],
  'plan preparation RPC exists'
);
select has_function(
  'public',
  'approve_availability_plan',
  array['uuid', 'integer', 'text'],
  'plan approval RPC exists'
);
select has_function(
  'public',
  'apply_approved_availability_plan',
  array['uuid', 'integer', 'text', 'uuid'],
  'plan application RPC exists'
);
select has_function(
  'public',
  'approve_and_apply_availability_plan',
  array['uuid', 'integer', 'text', 'uuid'],
  'delegated Owner apply RPC exists'
);
select has_function(
  'public',
  'respond_to_appointment_proposal',
  array['uuid', 'uuid', 'boolean'],
  'customer proposal response RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_availability_configuration(uuid,uuid)',
    'execute'
  ),
  'anon cannot read private availability configuration'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_availability_plan(uuid,uuid,jsonb,uuid)',
    'execute'
  ),
  'anon cannot prepare an owner plan'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_availability_configuration(uuid,uuid)',
    'execute'
  ),
  'authenticated can read the configuration RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.approve_and_apply_availability_plan(uuid,integer,text,uuid)',
    'execute'
  ),
  'anon cannot invoke delegated Owner apply'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.approve_and_apply_availability_plan(uuid,integer,text,uuid)',
    'execute'
  ),
  'authenticated can reach the Owner-guarded delegated apply RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.prepare_availability_plan(uuid,uuid,jsonb,uuid)',
    'execute'
  ),
  'authenticated can prepare a plan'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.approve_availability_plan(uuid,integer,text)',
    'execute'
  ),
  'authenticated can reach the owner-guarded approval RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_approved_availability_plan(uuid,integer,text,uuid)',
    'execute'
  ),
  'authenticated can reach the owner-guarded apply RPC'
);
select ok(
  has_function_privilege(
    'anon',
    'public.respond_to_appointment_proposal(uuid,uuid,boolean)',
    'execute'
  ),
  'anon can respond with a customer access token'
);

create temporary table availability_test_context (
  organization_id uuid not null,
  site_id uuid not null,
  service_id uuid not null,
  owner_id uuid not null,
  member_id uuid not null,
  other_owner_id uuid not null,
  next_saturday date not null,
  prepare_key_one uuid not null,
  prepare_key_two uuid not null,
  apply_key uuid not null
) on commit drop;

insert into availability_test_context (
  organization_id,
  site_id,
  service_id,
  owner_id,
  member_id,
  other_owner_id,
  next_saturday,
  prepare_key_one,
  prepare_key_two,
  apply_key
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  today + case
    when 6 - extract(isodow from today)::integer <= 0
      then 13 - extract(isodow from today)::integer
    else 6 - extract(isodow from today)::integer
  end,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
from (
  select (now() at time zone 'America/Lima')::date as today
) as current_day;

create temporary table availability_test_input (
  configuration jsonb not null
) on commit drop;

insert into availability_test_input (configuration)
select jsonb_build_object(
  'period_start', context.next_saturday,
  'period_end', context.next_saturday + 13,
  'timezone', 'America/Lima',
  'slot_duration_minutes', 30,
  'weekly_ranges', jsonb_build_array(
    jsonb_build_object(
      'day_of_week', 2,
      'starts_at', '09:00',
      'ends_at', '13:00'
    ),
    jsonb_build_object(
      'day_of_week', 4,
      'starts_at', '09:00',
      'ends_at', '13:00'
    ),
    jsonb_build_object(
      'day_of_week', 6,
      'starts_at', '09:00',
      'ends_at', '14:00'
    )
  ),
  'recurring_blocks', jsonb_build_array(
    jsonb_build_object(
      'starts_at', '12:00',
      'ends_at', '13:00'
    )
  ),
  'busy_intervals', jsonb_build_array(
    jsonb_build_object(
      'starts_at', (
        context.next_saturday + time '10:00'
      ) at time zone 'America/Lima',
      'ends_at', (
        context.next_saturday + time '11:30'
      ) at time zone 'America/Lima',
      'source', 'agent_context'
    )
  ),
  'preserve_existing_bookings', true
)
from availability_test_context as context;

insert into auth.users (id, email)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'owner-a@example.test'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'member-a@example.test'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'owner-b@example.test'
  );

insert into public.organizations (id, slug, name)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'availability-alpha',
    'Availability Alpha'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'availability-bravo',
    'Availability Bravo'
  );

insert into public.organization_memberships (
  organization_id,
  user_id,
  role
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'owner'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    'member'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-4333-8333-333333333333',
    'owner'
  );

insert into public.sites (
  id,
  organization_id,
  slug
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'availability-alpha-site'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'availability-bravo-site'
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
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'dermatology',
    'Dermatology consultation',
    'Focused skin and allergy care.',
    30
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'dermatology',
    'Dermatology consultation',
    'Focused skin and allergy care.',
    30
  );

insert into public.appointment_slots (
  organization_id,
  site_id,
  service_id,
  starts_at
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  (
    context.next_saturday
    + time '09:00'
    + (slot_index * interval '30 minutes')
  ) at time zone 'America/Lima'
from availability_test_context as context
cross join generate_series(0, 9) as slots(slot_index);

insert into public.appointment_slots (
  organization_id,
  site_id,
  service_id,
  starts_at
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  (
    context.next_saturday - 1
    + time '10:00'
  ) at time zone 'America/Lima'
from availability_test_context as context;

update public.appointment_slots as slot
set available = false
from availability_test_context as context
where slot.site_id = context.site_id
  and slot.service_id = context.service_id
  and slot.starts_at in (
    (
      context.next_saturday + time '10:00'
    ) at time zone 'America/Lima',
    (
      context.next_saturday + time '12:00'
    ) at time zone 'America/Lima'
  );

insert into public.appointment_requests (
  organization_id,
  site_id,
  service_id,
  slot_id,
  pet_name,
  customer_email,
  status,
  idempotency_key,
  confirmed_at
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  slot.id,
  booking.pet_name,
  booking.customer_email,
  'confirmed',
  booking.idempotency_key,
  now()
from availability_test_context as context
join lateral (
  values
    (
      'Luna'::text,
      'luna@example.test'::text,
      '20000000-0000-4000-8000-000000000001'::uuid,
      (
        context.next_saturday + time '10:00'
      ) at time zone 'America/Lima'
    ),
    (
      'Max'::text,
      'max@example.test'::text,
      '20000000-0000-4000-8000-000000000002'::uuid,
      (
        context.next_saturday + time '12:00'
      ) at time zone 'America/Lima'
    )
) as booking(pet_name, customer_email, idempotency_key, starts_at)
  on true
join public.appointment_slots as slot
  on slot.site_id = context.site_id
  and slot.service_id = context.service_id
  and slot.starts_at = booking.starts_at;

grant select on availability_test_context, availability_test_input
  to authenticated, anon;

set local role authenticated;
set local request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$
    select (public.get_availability_configuration(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ) ->> 'configured')::boolean
  $$,
  $$values (false)$$,
  'owner sees an unconfigured service before the first plan'
);

select lives_ok(
  $$
    select public.prepare_availability_plan(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (select configuration from availability_test_input),
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  'prepare persists a plan'
);

select is(
  (select count(*) from public.appointment_slots),
  11::bigint,
  'prepare does not add or remove slots'
);
select is(
  (select count(*) from public.appointment_requests),
  2::bigint,
  'prepare does not change appointment requests'
);
select is(
  (select count(*) from public.clinic_availability_configurations),
  0::bigint,
  'prepare does not apply a configuration'
);
select is(
  (select count(*) from public.availability_plans),
  1::bigint,
  'prepare creates one exact plan'
);
select results_eq(
  $$
    select (plan.preview ->> 'affected_count')::integer
    from public.availability_plans as plan
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
  $$,
  $$values (1)$$,
  'preview derives one affected appointment'
);
select results_eq(
  $$
    select (plan.preview ->> 'unaffected_count')::integer
    from public.availability_plans as plan
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
  $$,
  $$values (1)$$,
  'preview derives one unaffected appointment'
);
select results_eq(
  $$
    select request.pet_name
    from public.availability_plans as plan
    cross join lateral jsonb_array_elements(
      plan.preview -> 'affected_appointments'
    ) as affected(value)
    join public.appointment_requests as request
      on request.id = (affected.value ->> 'appointment_id')::uuid
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
  $$,
  $$values ('Luna'::text)$$,
  'busy context affects Luna server-side'
);
select results_eq(
  $$
    select request.pet_name
    from public.availability_plans as plan
    cross join lateral jsonb_array_elements(
      plan.preview -> 'unaffected_appointments'
    ) as unaffected(value)
    join public.appointment_requests as request
      on request.id = (unaffected.value ->> 'appointment_id')::uuid
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
  $$,
  $$values ('Max'::text)$$,
  'preserve_existing_bookings grandfathers Max through lunch'
);
select results_eq(
  $$
    select (
      affected.value ->> 'alternative_starts_at'
    )::timestamptz = (
      (
        (select next_saturday from availability_test_context)
        + time '11:30'
      ) at time zone 'America/Lima'
    )
    from public.availability_plans as plan
    cross join lateral jsonb_array_elements(
      plan.preview -> 'affected_appointments'
    ) as affected(value)
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
  $$,
  $$values (true)$$,
  'server proposes the closest later valid alternative at 11:30'
);
select results_eq(
  $$
    select count(*)
    from public.availability_plans as plan
    cross join lateral jsonb_array_elements_text(
      plan.preview -> 'generated_slot_starts'
    ) as generated(starts_at)
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000001'
      and generated.starts_at::timestamptz = (
        (
          (select next_saturday from availability_test_context)
          + time '12:00'
        ) at time zone 'America/Lima'
      )
  $$,
  $$values (0::bigint)$$,
  'recurring lunch removes 12:00 for new availability'
);

set local request.jwt.claim.sub =
  '22222222-2222-4222-8222-222222222222';
select throws_ok(
  $$
    select public.approve_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000001'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000001')
    )
  $$,
  '42501',
  'availability_plan_unavailable',
  'member cannot approve the availability plan'
);

set local role postgres;
update public.appointment_requests
set status = 'requested'
where pet_name = 'Max';
set local role authenticated;
set local request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$
    select public.approve_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000001'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000001')
    )
  $$,
  'PT409',
  'availability_plan_stale',
  'approval fails closed when bookings changed after prepare'
);

set local role postgres;
update public.appointment_requests
set status = 'confirmed'
where pet_name = 'Max';
set local role authenticated;

select lives_ok(
  $$
    select public.prepare_availability_plan(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (select configuration from availability_test_input),
      '10000000-0000-4000-8000-000000000002'
    )
  $$,
  'a fresh prepare captures the current booking revision'
);
select is(
  (select count(*) from public.availability_plans),
  2::bigint,
  'the stale plan remains auditable beside the fresh plan'
);

select throws_ok(
  $$
    select public.approve_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      repeat('0', 64)
    )
  $$,
  'PT409',
  'availability_plan_revision_conflict',
  'approval binds the exact plan hash'
);

select lives_ok(
  $$
    select public.approve_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002')
    )
  $$,
  'owner approval succeeds for the exact current plan'
);
select results_eq(
  $$
    select status::text
    from public.availability_plans
    where prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000002'
  $$,
  $$values ('approved'::text)$$,
  'approval is persisted on the exact plan'
);

select throws_ok(
  $$
    select public.apply_approved_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      repeat('0', 64),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  '22023',
  'availability_approval_invalid_or_expired',
  'apply rejects a hash different from the human approval'
);

select lives_ok(
  $$
    select public.apply_approved_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      '10000000-0000-4000-8000-000000000003'
    )
  $$,
  'owner applies the approved availability plan'
);

select results_eq(
  $$
    select (public.get_availability_configuration(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ) ->> 'configured')::boolean
  $$,
  $$values (true)$$,
  'applied configuration is readable by the owner'
);
select results_eq(
  $$
    select (public.get_availability_configuration(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ) ->> 'revision')::integer
  $$,
  $$values (1)$$,
  'first apply creates configuration revision one'
);
select results_eq(
  $$
    select (plan.applied_result -> 'customer_notifications' -> 0)
      ?& array['customer_email', 'access_token', 'proposed_starts_at']
    from public.availability_plans as plan
    where plan.prepare_idempotency_key =
      '10000000-0000-4000-8000-000000000002'
  $$,
  $$values (true)$$,
  'apply returns post-commit adapter data without sending email'
);
select results_eq(
  $$
    select request.status::text
    from public.appointment_requests as request
    where request.pet_name = 'Luna'
  $$,
  $$values ('time_proposed'::text)$$,
  'affected Luna is moved to time_proposed'
);
select results_eq(
  $$
    select request.proposed_starts_at = (
      (
        (select next_saturday from availability_test_context)
        + time '11:30'
      ) at time zone 'America/Lima'
    )
    from public.appointment_requests as request
    where request.pet_name = 'Luna'
  $$,
  $$values (true)$$,
  'Luna receives the server-derived 11:30 proposal'
);
select results_eq(
  $$
    select request.status::text
    from public.appointment_requests as request
    where request.pet_name = 'Max'
  $$,
  $$values ('confirmed'::text)$$,
  'preserved Max remains confirmed despite the lunch block'
);
select results_eq(
  $$
    select slot.available
    from public.appointment_slots as slot
    where slot.starts_at = (
      (
        (select next_saturday from availability_test_context)
        + time '12:00'
      ) at time zone 'America/Lima'
    )
  $$,
  $$values (false)$$,
  'grandfathered Max keeps the old slot occupied'
);
select results_eq(
  $$
    select slot.available
    from public.appointment_slots as slot
    where slot.starts_at = (
      (
        (select next_saturday from availability_test_context)
        + time '11:30'
      ) at time zone 'America/Lima'
    )
  $$,
  $$values (false)$$,
  'the proposed alternative is held before customer response'
);
select results_eq(
  $$
    select slot.available
    from public.appointment_slots as slot
    where slot.starts_at = (
      (
        (select next_saturday from availability_test_context)
        - 1 + time '10:00'
      ) at time zone 'America/Lima'
    )
  $$,
  $$values (true)$$,
  'a slot outside the configured period is unchanged'
);
select results_eq(
  $$
    select count(*)
    from public.audit_events
    where organization_id =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and action = 'availability_plan.applied'
  $$,
  $$values (1::bigint)$$,
  'apply emits one tenant-scoped audit event'
);

create temporary table availability_test_customer (
  request_id uuid not null,
  access_token uuid not null
) on commit drop;
insert into availability_test_customer (request_id, access_token)
select id, access_token
from public.appointment_requests
where pet_name = 'Luna';
grant select on availability_test_customer to anon;

select results_eq(
  $$
    select public.apply_approved_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      '10000000-0000-4000-8000-000000000003'
    ) = (
      select applied_result
      from public.availability_plans
      where prepare_idempotency_key =
        '10000000-0000-4000-8000-000000000002'
    )
  $$,
  $$values (true)$$,
  'repeating apply with the same key is idempotent'
);
select throws_ok(
  $$
    select public.apply_approved_availability_plan(
      (select id from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      0,
      (select plan_hash from public.availability_plans
       where prepare_idempotency_key =
         '10000000-0000-4000-8000-000000000002'),
      '10000000-0000-4000-8000-000000000004'
    )
  $$,
  '22023',
  'availability_plan_already_applied',
  'a different apply key cannot replay an applied plan'
);

set local role anon;
select throws_ok(
  $$
    select public.respond_to_appointment_proposal(
      (select request_id from availability_test_customer),
      '99999999-9999-4999-8999-999999999999',
      true
    )
  $$,
  '22023',
  'appointment_proposal_unavailable',
  'customer token is required to accept a proposal'
);
select lives_ok(
  $$
    select public.respond_to_appointment_proposal(
      (select request_id from availability_test_customer),
      (select access_token from availability_test_customer),
      true
    )
  $$,
  'customer can accept the held alternative'
);

set local role authenticated;
set local request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';
select results_eq(
  $$
    select request.status::text
    from public.appointment_requests as request
    where request.pet_name = 'Luna'
  $$,
  $$values ('confirmed'::text)$$,
  'accept confirms the proposed appointment'
);
select results_eq(
  $$
    select request.slot_id = slot.id
    from public.appointment_requests as request
    join public.appointment_slots as slot
      on slot.starts_at = (
        (
          (select next_saturday from availability_test_context)
          + time '11:30'
        ) at time zone 'America/Lima'
      )
    where request.pet_name = 'Luna'
  $$,
  $$values (true)$$,
  'accept points the request at the held alternative slot'
);
select results_eq(
  $$
    select request.proposed_starts_at is null
    from public.appointment_requests as request
    where request.pet_name = 'Luna'
  $$,
  $$values (true)$$,
  'accept consumes the pending proposal field'
);
select results_eq(
  $$
    select slot.available
    from public.appointment_slots as slot
    where slot.starts_at = (
      (
        (select next_saturday from availability_test_context)
        + time '11:30'
      ) at time zone 'America/Lima'
    )
  $$,
  $$values (false)$$,
  'accepted alternative remains reserved'
);

set local role postgres;
insert into public.appointment_requests (
  organization_id,
  site_id,
  service_id,
  slot_id,
  pet_name,
  customer_email,
  status,
  access_token,
  idempotency_key,
  proposed_starts_at
)
select
  context.organization_id,
  context.site_id,
  context.service_id,
  original_slot.id,
  'Ollie',
  'ollie@example.test',
  'time_proposed',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
  '20000000-0000-4000-8000-000000000003',
  hold_slot.starts_at
from availability_test_context as context
join public.appointment_slots as original_slot
  on original_slot.site_id = context.site_id
  and original_slot.service_id = context.service_id
  and original_slot.starts_at = (
    (
      context.next_saturday + time '13:30'
    ) at time zone 'America/Lima'
  )
join public.appointment_slots as hold_slot
  on hold_slot.site_id = context.site_id
  and hold_slot.service_id = context.service_id
  and hold_slot.starts_at = (
    (
      context.next_saturday + time '13:00'
    ) at time zone 'America/Lima'
  );
update public.appointment_slots as slot
set available = false
from availability_test_context as context
where slot.site_id = context.site_id
  and slot.service_id = context.service_id
  and slot.starts_at = (
    (
      context.next_saturday + time '13:00'
    ) at time zone 'America/Lima'
  );
create temporary table availability_test_ollie (
  request_id uuid not null,
  access_token uuid not null
) on commit drop;
insert into availability_test_ollie (request_id, access_token)
select id, access_token
from public.appointment_requests
where pet_name = 'Ollie';
grant select on availability_test_ollie to anon;
set local role anon;

select lives_ok(
  $$
    select public.respond_to_appointment_proposal(
      (select request_id from availability_test_ollie),
      (select access_token from availability_test_ollie),
      false
    )
  $$,
  'customer can decline a proposal'
);

set local role authenticated;
set local request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';
select results_eq(
  $$
    select request.status::text
    from public.appointment_requests as request
    where request.pet_name = 'Ollie'
  $$,
  $$values ('declined'::text)$$,
  'decline marks the request declined'
);
select results_eq(
  $$
    select slot.available
    from public.appointment_slots as slot
    where slot.starts_at = (
      (
        (select next_saturday from availability_test_context)
        + time '13:00'
      ) at time zone 'America/Lima'
    )
  $$,
  $$values (true)$$,
  'decline releases only the held alternative slot'
);

set local role authenticated;
set local request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';
select results_eq(
  $$select count(*) from public.clinic_availability_configurations$$,
  $$values (1::bigint)$$,
  'owner A sees only its configuration'
);
select results_eq(
  $$select count(*) from public.availability_plans$$,
  $$values (2::bigint)$$,
  'owner A sees only its plans'
);
select throws_ok(
  $$
    update public.clinic_availability_configurations
    set revision = revision + 1
    where organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'owner cannot bypass the configuration mutation RPC'
);

set local request.jwt.claim.sub =
  '33333333-3333-4333-8333-333333333333';
select results_eq(
  $$select count(*) from public.clinic_availability_configurations$$,
  $$values (0::bigint)$$,
  'owner B cannot read tenant A configuration'
);
select results_eq(
  $$select count(*) from public.availability_plans$$,
  $$values (0::bigint)$$,
  'owner B cannot read tenant A plans'
);

select * from finish();
rollback;
