begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('public', 'attention_items', 'attention items table exists');
select has_table('public', 'action_plans', 'action plans table exists');
select has_table('public', 'action_plan_steps', 'action plan steps table exists');
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.action_plans'::regclass
      and conname = 'action_plans_attention_tenant_fkey'
      and contype = 'f'
  ),
  'action plans preserve the attention item tenant'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.action_plan_steps'::regclass
      and conname = 'action_plan_steps_plan_tenant_fkey'
      and contype = 'f'
  ),
  'action plan steps preserve the parent plan tenant'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.attention_items'::regclass),
  'attention items has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.action_plans'::regclass),
  'action plans has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.action_plan_steps'::regclass),
  'action plan steps has RLS enabled'
);

select ok(
  has_table_privilege('authenticated', 'public.attention_items', 'select'),
  'authenticated can read attention through RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.attention_items',
    'insert,update,delete'
  ),
  'authenticated cannot mutate attention directly'
);
select ok(
  has_table_privilege('authenticated', 'public.action_plans', 'select'),
  'authenticated can read action plans through RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.action_plans',
    'insert,update,delete'
  ),
  'authenticated cannot mutate action plans directly'
);
select ok(
  has_table_privilege('authenticated', 'public.action_plan_steps', 'select'),
  'authenticated can read action plan steps through RLS'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.action_plan_steps',
    'insert,update,delete'
  ),
  'authenticated cannot mutate action plan steps directly'
);

select ok(
  not has_table_privilege('anon', 'public.attention_items', 'select'),
  'anon cannot read attention'
);
select ok(
  not has_table_privilege('anon', 'public.action_plans', 'select'),
  'anon cannot read action plans'
);
select ok(
  not has_table_privilege('anon', 'public.action_plan_steps', 'select'),
  'anon cannot read action plan steps'
);

select has_function(
  'public',
  'create_action_plan',
  array['uuid', 'uuid'],
  'create action plan RPC exists'
);
select has_function(
  'public',
  'acknowledge_lead_attention',
  array['uuid', 'integer'],
  'acknowledgement RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_action_plan(uuid,uuid)',
    'execute'
  ),
  'authenticated can execute action plan RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_action_plan(uuid,uuid)',
    'execute'
  ),
  'anon cannot execute action plan RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.acknowledge_lead_attention(uuid,integer)',
    'execute'
  ),
  'anon cannot execute acknowledgement RPC'
);

select * from finish();
rollback;
