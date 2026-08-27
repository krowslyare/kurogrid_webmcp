begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'demo_runtime_config', 'demo config table exists');
select has_table('public', 'demo_sandboxes', 'demo sandboxes table exists');
select has_table('public', 'demo_leases', 'demo leases table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.demo_runtime_config'::regclass), 'demo config has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.demo_sandboxes'::regclass), 'demo sandboxes has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.demo_leases'::regclass), 'demo leases has RLS');

select results_eq(
  $$select capacity from public.demo_runtime_config where singleton$$,
  $$values (2::smallint)$$,
  'default configured capacity is two'
);
select throws_ok(
  $$update public.demo_runtime_config set capacity = 1 where singleton$$,
  '23514',
  null,
  'capacity cannot be configured below two'
);

select ok(not has_table_privilege('anon', 'public.demo_runtime_config', 'select,insert,update,delete'), 'anon has no demo config privileges');
select ok(not has_table_privilege('anon', 'public.demo_sandboxes', 'select,insert,update,delete'), 'anon has no sandbox privileges');
select ok(not has_table_privilege('anon', 'public.demo_leases', 'select,insert,update,delete'), 'anon has no lease privileges');
select ok(not has_table_privilege('authenticated', 'public.demo_sandboxes', 'select,insert,update,delete'), 'authenticated has no sandbox privileges');
select ok(not has_table_privilege('authenticated', 'public.demo_leases', 'select,insert,update,delete'), 'authenticated has no lease privileges');

select has_function('public', 'claim_demo_sandbox', array['text', 'public.organization_role'], 'claim RPC exists');
select has_function('public', 'release_demo_sandbox', array['text'], 'release RPC exists');
select ok(has_function_privilege('service_role', 'public.claim_demo_sandbox(text,public.organization_role)', 'execute'), 'service role can claim a sandbox');
select ok(not has_function_privilege('anon', 'public.claim_demo_sandbox(text,public.organization_role)', 'execute'), 'anon cannot claim a sandbox directly');
select ok(not has_function_privilege('authenticated', 'public.release_demo_sandbox(text)', 'execute'), 'authenticated cannot release arbitrary leases');

select * from finish();
rollback;
