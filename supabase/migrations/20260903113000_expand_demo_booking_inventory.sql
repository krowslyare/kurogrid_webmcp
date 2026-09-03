-- Keep the resettable demo useful beyond one fixed recording date. The
-- baseline still preserves the Luna and Max story, while every published
-- service gets enough rolling inventory for the manual booking fallback.

create or replace function private.reset_demo_sandbox(p_sandbox_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sandbox public.demo_sandboxes%rowtype;
  v_site_id uuid;
  v_initial_content jsonb := jsonb_build_object(
    'headline', 'Thoughtful care for every stage.',
    'summary', 'Calm veterinary consultations with clear hours and easy appointment planning.',
    'opening_hours', jsonb_build_object(
      'weekdays', 'Monday–Friday · 08:00–18:00',
      'saturday', 'Saturday · 09:00–14:00'
    ),
    'cta_label', 'Plan a visit'
  );
  v_availability jsonb;
  v_version_id uuid;
  v_dermatology_id uuid;
  v_wellness_id uuid;
  v_vaccination_id uuid;
  v_luna_slot_id uuid;
  v_max_slot_id uuid;
  v_today_lima date;
  v_next_saturday date;
  v_week_start date;
  v_week_end date;
begin
  select *
  into v_sandbox
  from public.demo_sandboxes
  where id = p_sandbox_id;

  if v_sandbox.id is null then
    raise exception using
      errcode = '22023',
      message = 'sandbox_unavailable';
  end if;

  select id
  into v_site_id
  from public.sites
  where organization_id = v_sandbox.organization_id
  order by created_at
  limit 1;

  if v_site_id is not null then
    delete from public.availability_plans
    where site_id = v_site_id;
    delete from public.clinic_availability_configurations
    where site_id = v_site_id;
    delete from public.appointment_requests
    where site_id = v_site_id;
    delete from public.appointment_slots
    where site_id = v_site_id;
    delete from public.clinic_services
    where site_id = v_site_id;
    update public.sites
    set published_version_id = null
    where id = v_site_id;
    delete from public.publication_operations
    where site_id = v_site_id;
    delete from public.publish_approvals
    where site_id = v_site_id;
    delete from public.site_versions
    where site_id = v_site_id;
    delete from public.site_drafts
    where site_id = v_site_id;
  end if;

  delete from public.action_plan_steps
  where organization_id = v_sandbox.organization_id;
  delete from public.action_plans
  where organization_id = v_sandbox.organization_id;
  delete from public.attention_items
  where organization_id = v_sandbox.organization_id;
  delete from public.audit_events
  where organization_id = v_sandbox.organization_id;

  insert into public.attention_items (
    organization_id,
    kind,
    title,
    summary,
    evidence
  ) values
    (
      v_sandbox.organization_id,
      'synthetic_lead',
      'Saturday appointment requests need attention',
      'A fictional pet owner requested dermatology care on Saturday morning.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'contains_pii', false
      )
    ),
    (
      v_sandbox.organization_id,
      'analytics_snapshot',
      'Weekend demand is growing',
      'The fictional seven-day snapshot shows twice as much weekend appointment intent.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'period', '7d',
        'weekend_interest_count', 18,
        'weekday_interest_count', 9
      )
    ),
    (
      v_sandbox.organization_id,
      'verified_fact',
      'Saturday coverage is approved',
      'The clinic can accept selected Saturday appointments from 09:00 to 14:00.',
      jsonb_build_object(
        'source', 'synthetic_fixture',
        'fact', 'saturday_hours',
        'value', '09:00–14:00',
        'verified', true
      )
    );

  if v_site_id is not null then
    insert into public.site_versions (
      organization_id,
      site_id,
      version_number,
      source_draft_revision,
      content,
      content_hash,
      published_by
    ) values (
      v_sandbox.organization_id,
      v_site_id,
      1,
      1,
      v_initial_content,
      private.site_content_hash(v_initial_content),
      v_sandbox.owner_user_id
    )
    returning id into v_version_id;

    update public.sites
    set published_version_id = v_version_id
    where id = v_site_id;

    insert into public.clinic_services (
      organization_id,
      site_id,
      slug,
      name,
      description,
      duration_minutes
    ) values (
      v_sandbox.organization_id,
      v_site_id,
      'dermatology',
      'Dermatology consultation',
      'Focused care for skin, coat, ear, and allergy concerns.',
      30
    )
    returning id into v_dermatology_id;

    insert into public.clinic_services (
      organization_id,
      site_id,
      slug,
      name,
      description,
      duration_minutes
    ) values
      (
        v_sandbox.organization_id,
        v_site_id,
        'wellness-exam',
        'Wellness exam',
        'A calm preventive check-in for every life stage.',
        30
      )
      returning id into v_wellness_id;

    insert into public.clinic_services (
      organization_id,
      site_id,
      slug,
      name,
      description,
      duration_minutes
    ) values
      (
        v_sandbox.organization_id,
        v_site_id,
        'vaccination-review',
        'Vaccination review',
        'Review the current schedule and prepare the next recommended step.',
        20
      )
      returning id into v_vaccination_id;

    v_today_lima := (now() at time zone 'America/Lima')::date;
    v_next_saturday := v_today_lima
      + case
          when 6 - extract(isodow from v_today_lima)::integer <= 0
            then 13 - extract(isodow from v_today_lima)::integer
          else 6 - extract(isodow from v_today_lima)::integer
        end;

    -- One full week of inventory starting today. Sunday stays closed,
    -- matching the published opening hours; Luna and Max keep their
    -- Saturday story below.
    v_week_start := v_today_lima;
    v_week_end := v_today_lima + 6;

    v_availability := jsonb_build_object(
      'period_start', v_week_start,
      'period_end', v_week_end,
      'timezone', 'America/Lima',
      'slot_duration_minutes', 30,
      'weekly_ranges', jsonb_build_array(
        jsonb_build_object(
          'day_of_week', 1,
          'starts_at', '09:00',
          'ends_at', '18:00'
        ),
        jsonb_build_object(
          'day_of_week', 2,
          'starts_at', '09:00',
          'ends_at', '18:00'
        ),
        jsonb_build_object(
          'day_of_week', 3,
          'starts_at', '09:00',
          'ends_at', '18:00'
        ),
        jsonb_build_object(
          'day_of_week', 4,
          'starts_at', '09:00',
          'ends_at', '18:00'
        ),
        jsonb_build_object(
          'day_of_week', 5,
          'starts_at', '09:00',
          'ends_at', '18:00'
        ),
        jsonb_build_object(
          'day_of_week', 6,
          'starts_at', '09:00',
          'ends_at', '14:00'
        )
      ),
      'recurring_blocks', '[]'::jsonb,
      'busy_intervals', '[]'::jsonb,
      'preserve_existing_bookings', true
    );

    insert into public.clinic_availability_configurations (
      organization_id,
      site_id,
      service_id,
      period_start,
      period_end,
      timezone,
      slot_duration_minutes,
      weekly_rules,
      recurring_blocked_ranges,
      busy_intervals,
      preserve_existing_bookings,
      revision,
      configuration_hash
    ) values (
      v_sandbox.organization_id,
      v_site_id,
      v_dermatology_id,
      (v_availability ->> 'period_start')::date,
      (v_availability ->> 'period_end')::date,
      v_availability ->> 'timezone',
      (v_availability ->> 'slot_duration_minutes')::smallint,
      v_availability -> 'weekly_ranges',
      v_availability -> 'recurring_blocks',
      v_availability -> 'busy_intervals',
      (v_availability ->> 'preserve_existing_bookings')::boolean,
      1,
      private.availability_hash(v_availability)
    );

    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_dermatology_id,
      (
        v_next_saturday
        + time '09:00'
        + (slot_number * interval '30 minutes')
      ) at time zone 'America/Lima'
    from generate_series(0, 9) as slots(slot_number);

    -- Weekday inventory for the same service. Saturday rows above stay
    -- untouched so the Luna and Max fixtures keep their exact times.
    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_dermatology_id,
      (
        (v_week_start + days.day_offset)
        + times.slot_time
      ) at time zone 'America/Lima'
    from generate_series(0, 6) as days(day_offset)
    cross join (
      values
        (time '09:00'),
        (time '10:00'),
        (time '11:00'),
        (time '14:00'),
        (time '15:00')
    ) as times(slot_time)
    where extract(isodow from v_week_start + days.day_offset)::integer between 1 and 5;

    -- Bookable inventory for the other services so every catalog entry
    -- has live times. Luna and Max keep their dermatology story untouched.
    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_wellness_id,
      (
        v_next_saturday
        + time '09:00'
        + (slot_number * interval '30 minutes')
      ) at time zone 'America/Lima'
    from generate_series(0, 5) as slots(slot_number);

    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_vaccination_id,
      (
        v_next_saturday
        + time '09:30'
        + (slot_number * interval '20 minutes')
      ) at time zone 'America/Lima'
    from generate_series(0, 5) as slots(slot_number);

    -- Same weekday coverage for both services, mornings and mid-afternoon.
    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_wellness_id,
      (
        (v_week_start + days.day_offset)
        + times.slot_time
      ) at time zone 'America/Lima'
    from generate_series(0, 6) as days(day_offset)
    cross join (
      values
        (time '09:00'),
        (time '11:00'),
        (time '14:00')
    ) as times(slot_time)
    where extract(isodow from v_week_start + days.day_offset)::integer between 1 and 5;

    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at
    )
    select
      v_sandbox.organization_id,
      v_site_id,
      v_vaccination_id,
      (
        (v_week_start + days.day_offset)
        + times.slot_time
      ) at time zone 'America/Lima'
    from generate_series(0, 6) as days(day_offset)
    cross join (
      values
        (time '09:30'),
        (time '11:30'),
        (time '14:30')
    ) as times(slot_time)
    where extract(isodow from v_week_start + days.day_offset)::integer between 1 and 5;

    select slot.id
    into v_luna_slot_id
    from public.appointment_slots as slot
    where slot.site_id = v_site_id
      and slot.service_id = v_dermatology_id
      and slot.starts_at =
        (v_next_saturday + time '10:00') at time zone 'America/Lima';

    select slot.id
    into v_max_slot_id
    from public.appointment_slots as slot
    where slot.site_id = v_site_id
      and slot.service_id = v_dermatology_id
      and slot.starts_at =
        (v_next_saturday + time '12:00') at time zone 'America/Lima';

    update public.appointment_slots
    set available = false
    where id in (v_luna_slot_id, v_max_slot_id);

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
    ) values
      (
        v_sandbox.organization_id,
        v_site_id,
        v_dermatology_id,
        v_luna_slot_id,
        'Luna',
        'luna@example.test',
        'confirmed',
        extensions.gen_random_uuid(),
        now()
      ),
      (
        v_sandbox.organization_id,
        v_site_id,
        v_dermatology_id,
        v_max_slot_id,
        'Max',
        'max@example.test',
        'confirmed',
        extensions.gen_random_uuid(),
        now()
      );
  end if;
end;
$$;
