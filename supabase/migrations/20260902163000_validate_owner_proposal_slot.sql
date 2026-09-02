-- Owner proposals must name a real, currently available slot. The availability
-- plan disables slots for calendar busy ranges and confirmed bookings, so a
-- proposal accepted outside that rule would contradict the exact plan the
-- Owner just applied.

create or replace function public.owner_update_appointment_request(
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
  v_proposed_slot public.appointment_slots%rowtype;
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
  elsif p_decision = 'propose' and v_request.status = 'requested' then
    if p_proposed_starts_at is null or p_proposed_starts_at <= now() then
      raise exception using errcode = '22023', message = 'appointment_proposal_time_invalid';
    end if;

    -- The requested slot itself is unavailable while held, so this single rule
    -- rejects busy ranges, confirmed bookings, and plan-disabled times alike.
    select slot.* into v_proposed_slot
    from public.appointment_slots as slot
    where slot.site_id = v_request.site_id
      and slot.service_id = v_request.service_id
      and slot.starts_at = p_proposed_starts_at
      and slot.available;

    if v_proposed_slot.id is null then
      raise exception using errcode = '22023', message = 'appointment_proposal_slot_unavailable';
    end if;

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

revoke all on function public.owner_update_appointment_request(uuid, text, timestamptz) from public;
grant execute on function public.owner_update_appointment_request(uuid, text, timestamptz) to authenticated;

comment on function public.owner_update_appointment_request(uuid, text, timestamptz) is
  'Owner confirmation or proposal for one appointment request; proposals must name an available slot.';
