begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

select has_table('public', 'sites', 'sites table exists');
select has_table('public', 'site_drafts', 'site drafts table exists');
select has_table('public', 'site_versions', 'site versions table exists');
select has_table('public', 'publish_approvals', 'publish approvals table exists');
select has_table('public', 'publication_operations', 'publication operations table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.sites'::regclass), 'sites has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.site_drafts'::regclass), 'drafts has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.site_versions'::regclass), 'versions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.publish_approvals'::regclass), 'approvals has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.publication_operations'::regclass), 'operations has RLS');

select ok(has_table_privilege('authenticated', 'public.sites', 'select'), 'authenticated reads sites through RLS');
select ok(has_table_privilege('authenticated', 'public.site_drafts', 'select'), 'authenticated reads drafts through RLS');
select ok(has_table_privilege('authenticated', 'public.site_versions', 'select'), 'authenticated reads versions through RLS');
select ok(not has_table_privilege('authenticated', 'public.sites', 'insert,update,delete'), 'authenticated cannot mutate sites directly');
select ok(not has_table_privilege('authenticated', 'public.site_drafts', 'insert,update,delete'), 'authenticated cannot mutate drafts directly');
select ok(not has_table_privilege('authenticated', 'public.site_versions', 'insert,update,delete'), 'authenticated cannot mutate versions directly');

select ok(not has_table_privilege('anon', 'public.sites', 'select'), 'anon cannot read site rows');
select ok(not has_table_privilege('anon', 'public.site_drafts', 'select'), 'anon cannot read drafts');
select ok(not has_table_privilege('anon', 'public.site_versions', 'select'), 'anon cannot read version rows');

select has_function('public', 'create_or_patch_site_draft', array['uuid', 'integer', 'jsonb'], 'draft RPC exists');
select has_function('public', 'preview_publish_consequences', array['uuid'], 'preview RPC exists');
select has_function('public', 'approve_site_draft', array['uuid', 'integer', 'text'], 'approval RPC exists');
select has_function('public', 'publish_site_draft', array['uuid', 'integer', 'uuid', 'text', 'uuid'], 'publish RPC exists');
select has_function('public', 'rollback_site_version', array['uuid', 'uuid', 'uuid'], 'rollback RPC exists');
select ok(has_function_privilege('anon', 'public.get_published_site(text)', 'execute'), 'anon can execute published-only read RPC');

select * from finish();
rollback;
