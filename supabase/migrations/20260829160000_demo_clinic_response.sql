create function public.simulate_demo_clinic_response(
  p_request_id uuid,
  p_access_token uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_requests%rowtype;
  v_original_starts_at timestamptz;
begin
  select request.*
  into v_request
  from public.appointment_requests as request
  where request.id = p_request_id
    and request.access_token = p_access_token
  for update;

  if v_request.id is null or not exists (
    select 1
    from public.demo_sandboxes as sandbox
    where sandbox.organization_id = v_request.organization_id
  ) then
    raise insufficient_privilege using message = 'appointment_request_unavailable';
  end if;

  select slot.starts_at
  into v_original_starts_at
  from public.appointment_slots as slot
  where slot.id = v_request.slot_id;

  if v_request.status <> 'requested' then
    raise exception using errcode = '22023', message = 'demo_response_unavailable';
  end if;

  if p_decision = 'confirm' then
    update public.appointment_requests
      set status = 'confirmed', proposed_starts_at = null,
          confirmed_at = now(), updated_at = now()
      where id = v_request.id;
  elsif p_decision = 'propose' then
    update public.appointment_requests
      set status = 'time_proposed',
          proposed_starts_at = v_original_starts_at + interval '1 hour',
          updated_at = now()
      where id = v_request.id;
  else
    raise exception using errcode = '22023', message = 'invalid_demo_response';
  end if;

  return public.get_appointment_status(v_request.id, v_request.access_token)
    || jsonb_build_object('demo_simulated', true);
end;
$$;

revoke all on function public.simulate_demo_clinic_response(uuid, uuid, text) from public;
grant execute on function public.simulate_demo_clinic_response(uuid, uuid, text) to anon, authenticated;

comment on function public.simulate_demo_clinic_response(uuid, uuid, text) is
  'Demo-only clinic handoff. Requires the private request access token and a provisioned demo organization.';
