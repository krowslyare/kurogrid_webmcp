begin;

create extension if not exists pgtap with schema extensions;
select plan(37);

select has_schema('private', 'private helper schema exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table(
  'public',
  'organization_memberships',
  'organization memberships table exists'
);
select has_table('public', 'audit_events', 'audit events table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'organizations has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_memberships'::regclass),
  'organization memberships has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit events has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.organizations', 'select,insert,update,delete'),
  'anon has no organization privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.organizations', 'select'),
  'authenticated can select organizations'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'insert,update,delete'),
  'authenticated cannot mutate organizations'
);
select ok(
  has_table_privilege('authenticated', 'public.organization_memberships', 'select'),
  'authenticated can select memberships'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.organization_memberships',
    'insert,update,delete'
  ),
  'authenticated cannot mutate memberships'
);
select ok(
  has_table_privilege('authenticated', 'public.audit_events', 'select'),
  'authenticated can select audit events'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'insert,update,delete'),
  'authenticated cannot mutate audit events'
);
select ok(
  not has_table_privilege('service_role', 'public.audit_events', 'update,delete'),
  'service role cannot rewrite or directly delete audit events'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.has_organization_role(uuid,public.organization_role[])',
    'execute'
  ),
  'anon cannot execute the membership helper'
);
select ok(
  has_function_privilege(
    'authenticated',
    'private.has_organization_role(uuid,public.organization_role[])',
    'execute'
  ),
  'authenticated can execute the membership helper through RLS'
);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'member-a@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'owner-b@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'outsider@example.test');

insert into public.organizations (id, slug, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alpha', 'Alpha Studio'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bravo', 'Bravo Works');

insert into public.organization_memberships (organization_id, user_id, role)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'owner'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'member'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    'owner'
  );

insert into public.audit_events (
  organization_id,
  actor_user_id,
  action,
  target_type
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'organization.created',
    'organization'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    'organization.created',
    'organization'
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select count(*) from public.organizations$$,
  $$values (1::bigint)$$,
  'owner A sees one organization'
);
select results_eq(
  $$select count(*) from public.organization_memberships$$,
  $$values (2::bigint)$$,
  'owner A sees memberships only in organization A'
);
select results_eq(
  $$select count(*) from public.audit_events$$,
  $$values (1::bigint)$$,
  'owner A sees organization A audit events'
);
select results_eq(
  $$select count(*) from public.organizations where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  $$values (0::bigint)$$,
  'owner A cannot target organization B'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select results_eq(
  $$select count(*) from public.organizations$$,
  $$values (1::bigint)$$,
  'member A sees organization A'
);
select results_eq(
  $$select count(*) from public.organization_memberships$$,
  $$values (1::bigint)$$,
  'member A sees only its own membership'
);
select results_eq(
  $$select count(*) from public.audit_events$$,
  $$values (0::bigint)$$,
  'member A cannot read owner-only audit events'
);
select throws_ok(
  $$update public.organization_memberships set role = 'owner' where user_id = '22222222-2222-2222-2222-222222222222'$$,
  '42501',
  null,
  'member A cannot escalate its role'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$select count(*) from public.organizations$$,
  $$values (1::bigint)$$,
  'owner B sees one organization'
);
select results_eq(
  $$select count(*) from public.organization_memberships$$,
  $$values (1::bigint)$$,
  'owner B sees only organization B membership'
);
select results_eq(
  $$select count(*) from public.audit_events$$,
  $$values (1::bigint)$$,
  'owner B sees organization B audit events'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select results_eq(
  $$select count(*) from public.organizations$$,
  $$values (0::bigint)$$,
  'outsider sees no organizations'
);
select results_eq(
  $$select count(*) from public.organization_memberships$$,
  $$values (0::bigint)$$,
  'outsider sees no memberships'
);
select results_eq(
  $$select count(*) from public.audit_events$$,
  $$values (0::bigint)$$,
  'outsider sees no audit events'
);

select throws_ok(
  $$insert into public.organizations (slug, name) values ('forbidden', 'Forbidden')$$,
  '42501',
  null,
  'authenticated cannot insert organizations'
);
select throws_ok(
  $$update public.organizations set name = 'Forbidden'$$,
  '42501',
  null,
  'authenticated cannot update organizations'
);
select throws_ok(
  $$delete from public.organizations$$,
  '42501',
  null,
  'authenticated cannot delete organizations'
);

reset role;
reset request.jwt.claim.sub;
set local role anon;

select throws_ok(
  $$select * from public.organizations$$,
  '42501',
  null,
  'anon cannot select organizations'
);
select throws_ok(
  $$select * from public.organization_memberships$$,
  '42501',
  null,
  'anon cannot select memberships'
);
select throws_ok(
  $$select * from public.audit_events$$,
  '42501',
  null,
  'anon cannot select audit events'
);

select * from finish();
rollback;
