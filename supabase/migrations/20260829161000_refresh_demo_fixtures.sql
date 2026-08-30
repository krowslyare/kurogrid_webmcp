create function public.refresh_demo_fixtures()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sandbox public.demo_sandboxes%rowtype;
  v_site_id uuid;
  v_service_id uuid;
  v_next_saturday date;
  v_refreshed integer := 0;
begin
  for v_sandbox in
    select * from public.demo_sandboxes where enabled order by slot_number
  loop
    perform private.reset_demo_sandbox(v_sandbox.id);

    select site.id into v_site_id
    from public.sites as site
    where site.organization_id = v_sandbox.organization_id
    order by site.created_at
    limit 1;

    select service.id into v_service_id
    from public.clinic_services as service
    where service.site_id = v_site_id and service.slug = 'dermatology';

    v_next_saturday := current_date
      + (case when 6 - extract(isodow from current_date)::integer <= 0
              then 13 - extract(isodow from current_date)::integer
              else 6 - extract(isodow from current_date)::integer end);

    insert into public.appointment_slots (
      organization_id, site_id, service_id, starts_at
    ) values
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '09:00') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '10:00') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '11:00') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '12:00') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '12:30') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '13:00') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_service_id, (v_next_saturday + time '13:30') at time zone 'America/Lima')
    on conflict (site_id, service_id, starts_at) do update set available = true;

    v_refreshed := v_refreshed + 1;
  end loop;

  return v_refreshed;
end;
$$;

revoke all on function public.refresh_demo_fixtures() from public;
grant execute on function public.refresh_demo_fixtures() to service_role;

comment on function public.refresh_demo_fixtures() is
  'Service-only operational reset for fictional challenge data and ten customer appointment times per sandbox.';
