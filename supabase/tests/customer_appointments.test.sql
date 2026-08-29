begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'clinic_services', 'clinic services table exists');
select has_table('public', 'appointment_slots', 'appointment slots table exists');
select has_table('public', 'appointment_requests', 'appointment requests table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.clinic_services'::regclass), 'clinic services has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.appointment_slots'::regclass), 'appointment slots has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.appointment_requests'::regclass), 'appointment requests has RLS');

select ok(not has_table_privilege('anon', 'public.clinic_services', 'select,insert,update,delete'), 'anon has no direct service access');
select ok(not has_table_privilege('anon', 'public.appointment_slots', 'select,insert,update,delete'), 'anon has no direct slot access');
select ok(not has_table_privilege('anon', 'public.appointment_requests', 'select,insert,update,delete'), 'anon has no direct request access');

select has_function('public', 'get_clinic_services', array['text'], 'service discovery RPC exists');
select has_function('public', 'find_appointment_slots', array['text', 'text', 'date'], 'slot discovery RPC exists');
select has_function('public', 'prepare_appointment_request', array['text', 'text', 'uuid', 'text', 'text', 'uuid'], 'request preparation RPC exists');
select has_function('public', 'confirm_appointment_request', array['uuid', 'uuid'], 'exact confirmation RPC exists');
select has_function('public', 'get_appointment_status', array['uuid', 'uuid'], 'private status RPC exists');
select has_function('public', 'respond_to_appointment_proposal', array['uuid', 'uuid', 'boolean'], 'customer response RPC exists');
select has_function('public', 'owner_update_appointment_request', array['uuid', 'text', 'timestamptz'], 'owner response RPC exists');

select ok(has_function_privilege('anon', 'public.prepare_appointment_request(text,text,uuid,text,text,uuid)', 'execute'), 'anon can prepare through the bounded RPC');
select ok(has_function_privilege('anon', 'public.confirm_appointment_request(uuid,uuid)', 'execute'), 'anon can confirm with the exact token');
select ok(not has_function_privilege('anon', 'public.owner_update_appointment_request(uuid,text,timestamptz)', 'execute'), 'anon cannot make owner decisions');
select ok(has_function_privilege('authenticated', 'public.owner_update_appointment_request(uuid,text,timestamptz)', 'execute'), 'authenticated role can reach the owner-guarded RPC');

select * from finish();
rollback;
