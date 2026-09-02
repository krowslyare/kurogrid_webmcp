create type public.availability_plan_status as enum (
  'prepared',
  'approved',
  'applied'
);

create table public.clinic_availability_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null,
  service_id uuid not null,
  period_start date not null,
  period_end date not null,
  timezone text not null default 'America/Lima',
  slot_duration_minutes smallint not null,
  weekly_rules jsonb not null,
  recurring_blocked_ranges jsonb not null default '[]'::jsonb,
  busy_intervals jsonb not null default '[]'::jsonb,
  preserve_existing_bookings boolean not null default true,
  revision integer not null default 1,
  configuration_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_availability_configurations_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint clinic_availability_configurations_service_tenant_fkey
    foreign key (service_id, organization_id)
    references public.clinic_services(id, organization_id) on delete cascade,
  constraint clinic_availability_configurations_period_valid
    check (period_end >= period_start and period_end - period_start <= 366),
  constraint clinic_availability_configurations_timezone_not_blank
    check (length(btrim(timezone)) between 1 and 80),
  constraint clinic_availability_configurations_duration_valid
    check (
      slot_duration_minutes between 5 and 180
      and slot_duration_minutes % 5 = 0
    ),
  constraint clinic_availability_configurations_rules_are_arrays
    check (
      jsonb_typeof(weekly_rules) = 'array'
      and jsonb_typeof(recurring_blocked_ranges) = 'array'
      and jsonb_typeof(busy_intervals) = 'array'
    ),
  constraint clinic_availability_configurations_revision_positive
    check (revision > 0),
  constraint clinic_availability_configurations_hash_format
    check (configuration_hash ~ '^[0-9a-f]{64}$'),
  unique (id, organization_id),
  unique (site_id, service_id)
);

create table public.availability_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  site_id uuid not null,
  service_id uuid not null,
  base_configuration_id uuid,
  base_configuration_revision integer not null default 0,
  base_configuration_hash text,
  configuration jsonb not null,
  plan_hash text not null,
  preview jsonb not null,
  preview_hash text not null,
  prepare_idempotency_key uuid not null,
  prepared_by uuid not null references auth.users(id) on delete restrict,
  status public.availability_plan_status not null default 'prepared',
  approved_by uuid references auth.users(id) on delete restrict,
  approved_revision integer,
  approved_configuration_hash text,
  approved_plan_hash text,
  approved_at timestamptz,
  approval_expires_at timestamptz,
  applied_by uuid references auth.users(id) on delete restrict,
  applied_at timestamptz,
  consumed_at timestamptz,
  apply_idempotency_key uuid,
  applied_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_plans_site_tenant_fkey
    foreign key (site_id, organization_id)
    references public.sites(id, organization_id) on delete cascade,
  constraint availability_plans_service_tenant_fkey
    foreign key (service_id, organization_id)
    references public.clinic_services(id, organization_id) on delete cascade,
  constraint availability_plans_base_configuration_tenant_fkey
    foreign key (base_configuration_id, organization_id)
    references public.clinic_availability_configurations(id, organization_id)
    on delete restrict,
  constraint availability_plans_base_revision_nonnegative
    check (base_configuration_revision >= 0),
  constraint availability_plans_hash_format
    check (
      plan_hash ~ '^[0-9a-f]{64}$'
      and preview_hash ~ '^[0-9a-f]{64}$'
      and (
        base_configuration_hash is null
        or base_configuration_hash ~ '^[0-9a-f]{64}$'
      )
      and (
        approved_configuration_hash is null
        or approved_configuration_hash ~ '^[0-9a-f]{64}$'
      )
      and (
        approved_plan_hash is null
        or approved_plan_hash ~ '^[0-9a-f]{64}$'
      )
    ),
  constraint availability_plans_configuration_is_object
    check (
      jsonb_typeof(configuration) = 'object'
      and jsonb_typeof(preview) = 'object'
    ),
  constraint availability_plans_approval_consistency
    check (
      (
        approved_by is null
        and approved_revision is null
        and approved_configuration_hash is null
        and approved_plan_hash is null
        and approved_at is null
        and approval_expires_at is null
      )
      or (
        approved_by is not null
        and approved_revision is not null
        and (
          approved_configuration_hash is not null
          or base_configuration_hash is null
        )
        and approved_plan_hash is not null
        and approved_at is not null
        and approval_expires_at is not null
        and approval_expires_at > approved_at
      )
    ),
  constraint availability_plans_applied_consistency
    check (
      (
        applied_at is null
        and applied_by is null
        and consumed_at is null
        and apply_idempotency_key is null
        and applied_result is null
      )
      or (
        applied_at is not null
        and applied_by is not null
        and consumed_at is not null
        and apply_idempotency_key is not null
        and jsonb_typeof(applied_result) = 'object'
      )
    ),
  unique (id, organization_id),
  unique (organization_id, prepare_idempotency_key)
);

create unique index availability_plans_one_apply_key_per_organization_idx
  on public.availability_plans(organization_id, apply_idempotency_key)
  where apply_idempotency_key is not null;

create index clinic_availability_configurations_organization_idx
  on public.clinic_availability_configurations(organization_id, updated_at desc);
create index availability_plans_organization_created_idx
  on public.availability_plans(organization_id, created_at desc);
create index availability_plans_site_service_status_idx
  on public.availability_plans(site_id, service_id, status, created_at desc);

alter table public.clinic_availability_configurations enable row level security;
alter table public.availability_plans enable row level security;

create policy "Members read availability configurations"
on public.clinic_availability_configurations
for select
to authenticated
using ((select private.has_organization_role(organization_id)));

create policy "Members read availability plans"
on public.availability_plans
for select
to authenticated
using ((select private.has_organization_role(organization_id)));

create function private.normalize_availability_configuration(
  p_configuration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date;
  v_period_end date;
  v_timezone text;
  v_duration integer;
  v_preserve boolean;
  v_weekly_ranges jsonb := '[]'::jsonb;
  v_recurring_blocks jsonb := '[]'::jsonb;
  v_busy_intervals jsonb := '[]'::jsonb;
  v_weekly_input jsonb;
  v_blocked_input jsonb;
  v_web_weekly boolean;
  v_web_blocked boolean;
  v_rule jsonb;
  v_block jsonb;
  v_busy jsonb;
  v_day_of_week integer;
  v_start_time time;
  v_end_time time;
  v_busy_start timestamptz;
  v_busy_end timestamptz;
  v_source text;
begin
  if p_configuration is null
    or jsonb_typeof(p_configuration) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'invalid_availability_configuration';
  end if;

  if coalesce(p_configuration ->> 'period_start', '') !~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(p_configuration ->> 'period_end', '') !~
       '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid_availability_period';
  end if;

  v_period_start := (p_configuration ->> 'period_start')::date;
  v_period_end := (p_configuration ->> 'period_end')::date;

  if v_period_end < v_period_start
    or v_period_end - v_period_start > 366 then
    raise exception using
      errcode = '22023',
      message = 'invalid_availability_period';
  end if;

  v_timezone := coalesce(
    nullif(btrim(p_configuration ->> 'timezone'), ''),
    'America/Lima'
  );

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_timezone
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_availability_timezone';
  end if;

  if coalesce(p_configuration ->> 'slot_duration_minutes', '') !~
       '^[0-9]+$' then
    raise exception using
      errcode = '22023',
      message = 'invalid_slot_duration';
  end if;

  v_duration := (p_configuration ->> 'slot_duration_minutes')::integer;
  if v_duration < 5 or v_duration > 180 or v_duration % 5 <> 0 then
    raise exception using
      errcode = '22023',
      message = 'invalid_slot_duration';
  end if;

  if p_configuration ? 'preserve_existing_bookings'
    and jsonb_typeof(p_configuration -> 'preserve_existing_bookings')
      <> 'boolean' then
    raise exception using
      errcode = '22023',
      message = 'invalid_preserve_existing_bookings';
  end if;

  v_preserve := coalesce(
    (p_configuration ->> 'preserve_existing_bookings')::boolean,
    true
  );

  if not v_preserve then
    raise exception using
      errcode = '22023',
      message = 'preserve_existing_bookings_required';
  end if;

  v_web_weekly := p_configuration ? 'weekly_ranges';
  v_weekly_input := case
    when v_web_weekly then p_configuration -> 'weekly_ranges'
    else p_configuration -> 'weekly_rules'
  end;

  if jsonb_typeof(v_weekly_input) <> 'array'
    or jsonb_array_length(v_weekly_input) = 0 then
    raise exception using
      errcode = '22023',
      message = 'invalid_weekly_ranges';
  end if;

  for v_rule in
    select value
    from pg_catalog.jsonb_array_elements(v_weekly_input)
  loop
    if v_web_weekly then
      if jsonb_typeof(v_rule) <> 'object'
        or (v_rule - array['day_of_week', 'starts_at', 'ends_at'])
          <> '{}'::jsonb
        or v_rule ->> 'day_of_week' !~ '^[0-6]$'
        or v_rule ->> 'starts_at'
          !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_rule ->> 'ends_at'
          !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
        raise exception using
          errcode = '22023',
          message = 'invalid_weekly_ranges';
      end if;

      v_day_of_week := (v_rule ->> 'day_of_week')::integer;
      v_start_time := (v_rule ->> 'starts_at')::time;
      v_end_time := (v_rule ->> 'ends_at')::time;
    elsif jsonb_typeof(v_rule) <> 'object'
      or (v_rule - array['weekday', 'start', 'end']) <> '{}'::jsonb
      or v_rule ->> 'weekday' !~ '^[1-7]$'
      or v_rule ->> 'start' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      or v_rule ->> 'end' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using
        errcode = '22023',
        message = 'invalid_weekly_ranges';
    else
      v_day_of_week := case
        when (v_rule ->> 'weekday')::integer = 7 then 0
        else (v_rule ->> 'weekday')::integer
      end;
      v_start_time := (v_rule ->> 'start')::time;
      v_end_time := (v_rule ->> 'end')::time;
    end if;

    if v_start_time >= v_end_time then
      raise exception using
        errcode = '22023',
        message = 'invalid_weekly_ranges';
    end if;

    v_weekly_ranges := v_weekly_ranges || jsonb_build_array(
      jsonb_build_object(
        'day_of_week', v_day_of_week,
        'starts_at', to_char(v_start_time, 'HH24:MI'),
        'ends_at', to_char(v_end_time, 'HH24:MI')
      )
    );
  end loop;

  v_web_blocked := p_configuration ? 'recurring_blocks';
  v_blocked_input := case
    when v_web_blocked then p_configuration -> 'recurring_blocks'
    else p_configuration -> 'recurring_blocked_ranges'
  end;

  if v_blocked_input is not null
    and jsonb_typeof(v_blocked_input) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'invalid_recurring_blocks';
  end if;

  for v_block in
    select value
    from pg_catalog.jsonb_array_elements(
      coalesce(v_blocked_input, '[]'::jsonb)
    )
  loop
    if v_web_blocked then
      if jsonb_typeof(v_block) <> 'object'
        or (
          v_block
          - array['day_of_week', 'starts_at', 'ends_at']
        ) <> '{}'::jsonb
        or v_block ->> 'starts_at'
          !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_block ->> 'ends_at'
          !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        or (
          v_block ? 'day_of_week'
          and v_block ->> 'day_of_week' !~ '^[0-6]$'
        ) then
        raise exception using
          errcode = '22023',
          message = 'invalid_recurring_blocks';
      end if;

      v_start_time := (v_block ->> 'starts_at')::time;
      v_end_time := (v_block ->> 'ends_at')::time;
      if v_block ? 'day_of_week' then
        v_day_of_week := (v_block ->> 'day_of_week')::integer;
      else
        v_day_of_week := null;
      end if;
    elsif jsonb_typeof(v_block) <> 'object'
      or (v_block - array['weekday', 'start', 'end']) <> '{}'::jsonb
      or v_block ->> 'start' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      or v_block ->> 'end' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      or (
        v_block ? 'weekday'
        and v_block ->> 'weekday' !~ '^[1-7]$'
      ) then
      raise exception using
        errcode = '22023',
        message = 'invalid_recurring_blocks';
    else
      v_start_time := (v_block ->> 'start')::time;
      v_end_time := (v_block ->> 'end')::time;
      if v_block ? 'weekday' then
        v_day_of_week := case
          when (v_block ->> 'weekday')::integer = 7 then 0
          else (v_block ->> 'weekday')::integer
        end;
      else
        v_day_of_week := null;
      end if;
    end if;

    if v_start_time >= v_end_time then
      raise exception using
        errcode = '22023',
        message = 'invalid_recurring_blocks';
    end if;

    v_recurring_blocks := v_recurring_blocks || jsonb_build_array(
      case
        when v_day_of_week is null then jsonb_build_object(
          'starts_at', to_char(v_start_time, 'HH24:MI'),
          'ends_at', to_char(v_end_time, 'HH24:MI')
        )
        else jsonb_build_object(
          'day_of_week', v_day_of_week,
          'starts_at', to_char(v_start_time, 'HH24:MI'),
          'ends_at', to_char(v_end_time, 'HH24:MI')
        )
      end
    );
  end loop;

  if p_configuration ? 'busy_intervals'
    and jsonb_typeof(p_configuration -> 'busy_intervals') <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'invalid_busy_intervals';
  end if;

  for v_busy in
    select value
    from pg_catalog.jsonb_array_elements(
      coalesce(p_configuration -> 'busy_intervals', '[]'::jsonb)
    )
  loop
    if jsonb_typeof(v_busy) <> 'object'
      or (v_busy - array['starts_at', 'ends_at', 'source'])
        <> '{}'::jsonb
      or coalesce(v_busy ->> 'starts_at', '') = ''
      or coalesce(v_busy ->> 'ends_at', '') = '' then
      raise exception using
        errcode = '22023',
        message = 'invalid_busy_intervals';
    end if;

    v_source := coalesce(
      nullif(btrim(v_busy ->> 'source'), ''),
      'agent_context'
    );
    if v_source !~ '^[a-z][a-z0-9_-]{0,31}$' then
      raise exception using
        errcode = '22023',
        message = 'invalid_busy_intervals';
    end if;

    begin
      v_busy_start := (v_busy ->> 'starts_at')::timestamptz;
      v_busy_end := (v_busy ->> 'ends_at')::timestamptz;
    exception when others then
      raise exception using
        errcode = '22023',
        message = 'invalid_busy_intervals';
    end;

    if v_busy_start >= v_busy_end then
      raise exception using
        errcode = '22023',
        message = 'invalid_busy_intervals';
    end if;

    v_busy_intervals := v_busy_intervals || jsonb_build_array(
      jsonb_build_object(
        'starts_at', v_busy_start,
        'ends_at', v_busy_end,
        'source', v_source
      )
    );
  end loop;

  return jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'timezone', v_timezone,
    'slot_duration_minutes', v_duration,
    'weekly_ranges', v_weekly_ranges,
    'recurring_blocks', v_recurring_blocks,
    'busy_intervals', v_busy_intervals,
    'preserve_existing_bookings', v_preserve
  );
end;
$$;

create function private.availability_hash(p_value jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(p_value::text, 'sha256'), 'hex');
$$;

create function private.availability_preview(
  p_site_id uuid,
  p_service_id uuid,
  p_configuration jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period_start date := (p_configuration ->> 'period_start')::date;
  v_period_end date := (p_configuration ->> 'period_end')::date;
  v_timezone text := p_configuration ->> 'timezone';
  v_duration integer := (p_configuration ->> 'slot_duration_minutes')::integer;
  v_preserve boolean := (p_configuration ->> 'preserve_existing_bookings')::boolean;
  v_generated_starts timestamptz[] := array[]::timestamptz[];
  v_assigned_alternatives timestamptz[] := array[]::timestamptz[];
  v_slots_to_create jsonb := '[]'::jsonb;
  v_slots_to_disable jsonb := '[]'::jsonb;
  v_affected_appointments jsonb := '[]'::jsonb;
  v_unaffected_appointments jsonb := '[]'::jsonb;
  v_day date;
  v_day_of_week integer;
  v_rule jsonb;
  v_cursor timestamp without time zone;
  v_rule_end timestamp without time zone;
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
  v_candidate timestamptz;
  v_alternative timestamptz;
  v_booking record;
  v_slot record;
begin
  for v_day_offset in 0..(v_period_end - v_period_start)
  loop
    v_day := v_period_start + v_day_offset;
    v_day_of_week := extract(dow from v_day)::integer;

    for v_rule in
      select value
      from pg_catalog.jsonb_array_elements(p_configuration -> 'weekly_ranges')
      order by (value ->> 'starts_at')::time,
        (value ->> 'ends_at')::time
    loop
      if (v_rule ->> 'day_of_week')::integer <> v_day_of_week then
        continue;
      end if;

      v_cursor := v_day::timestamp + (v_rule ->> 'starts_at')::time;
      v_rule_end := v_day::timestamp + (v_rule ->> 'ends_at')::time;

      while v_cursor + make_interval(mins => v_duration) <= v_rule_end
      loop
        v_candidate_start := v_cursor at time zone v_timezone;
        v_candidate_end := (
          v_cursor + make_interval(mins => v_duration)
        ) at time zone v_timezone;

        if not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            p_configuration -> 'recurring_blocks'
          ) as blocked(value)
          where (
            not (blocked.value ? 'day_of_week')
            or (blocked.value ->> 'day_of_week')::integer = v_day_of_week
          )
          and v_cursor
            < v_day::timestamp + (blocked.value ->> 'ends_at')::time
          and v_cursor + make_interval(mins => v_duration)
            > v_day::timestamp + (blocked.value ->> 'starts_at')::time
        )
        and not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            p_configuration -> 'busy_intervals'
          ) as busy(value)
          where v_candidate_start < (busy.value ->> 'ends_at')::timestamptz
            and v_candidate_end > (busy.value ->> 'starts_at')::timestamptz
        )
        and not (v_candidate_start = any(v_generated_starts)) then
          v_generated_starts := array_append(
            v_generated_starts,
            v_candidate_start
          );
        end if;

        v_cursor := v_cursor + make_interval(mins => v_duration);
      end loop;
    end loop;
  end loop;

  for v_slot in
    select slot.id, slot.starts_at
    from public.appointment_slots as slot
    where slot.site_id = p_site_id
      and slot.service_id = p_service_id
      and (slot.starts_at at time zone v_timezone)::date
        between v_period_start and v_period_end
    order by slot.starts_at, slot.id
  loop
    if not (v_slot.starts_at = any(v_generated_starts)) then
      v_slots_to_disable := v_slots_to_disable || jsonb_build_array(
        jsonb_build_object(
          'slot_id', v_slot.id,
          'starts_at', v_slot.starts_at
        )
      );
    end if;
  end loop;

  for v_candidate in
    select starts_at
    from unnest(v_generated_starts) as generated(starts_at)
  loop
    if not exists (
      select 1
      from public.appointment_slots as slot
      where slot.site_id = p_site_id
        and slot.service_id = p_service_id
        and slot.starts_at = v_candidate
    ) then
      v_slots_to_create := v_slots_to_create || jsonb_build_array(
        jsonb_build_object('starts_at', v_candidate)
      );
    end if;
  end loop;

  for v_booking in
    select
      request.id,
      request.status,
      request.slot_id,
      request.proposed_starts_at,
      slot.starts_at as original_starts_at,
      coalesce(request.proposed_starts_at, slot.starts_at)
        as current_starts_at,
      service.duration_minutes
    from public.appointment_requests as request
    join public.appointment_slots as slot on slot.id = request.slot_id
      and slot.site_id = request.site_id
      and slot.service_id = request.service_id
    join public.clinic_services as service on service.id = request.service_id
    where request.site_id = p_site_id
      and request.service_id = p_service_id
      and request.status in (
        'requested'::public.appointment_request_status,
        'confirmed'::public.appointment_request_status,
        'time_proposed'::public.appointment_request_status
      )
      and (
        coalesce(request.proposed_starts_at, slot.starts_at)
          at time zone v_timezone
      )::date between v_period_start and v_period_end
    order by coalesce(request.proposed_starts_at, slot.starts_at), request.id
  loop
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(
        p_configuration -> 'busy_intervals'
      ) as busy(value)
      where v_booking.current_starts_at
          < (busy.value ->> 'ends_at')::timestamptz
        and v_booking.current_starts_at
            + make_interval(mins => v_booking.duration_minutes)
          > (busy.value ->> 'starts_at')::timestamptz
    )
    or (
      not v_preserve
      and not (v_booking.current_starts_at = any(v_generated_starts))
    ) then
      v_alternative := null;

      select candidate.starts_at
      into v_alternative
      from unnest(v_generated_starts) as candidate(starts_at)
      where not exists (
        select 1
        from public.appointment_requests as other_request
        join public.appointment_slots as other_slot
          on other_slot.id = other_request.slot_id
          and other_slot.site_id = other_request.site_id
          and other_slot.service_id = other_request.service_id
        join public.clinic_services as other_service
          on other_service.id = other_request.service_id
        where other_request.site_id = p_site_id
          and other_request.service_id = p_service_id
          and other_request.status in (
            'requested'::public.appointment_request_status,
            'confirmed'::public.appointment_request_status,
            'time_proposed'::public.appointment_request_status
          )
          and other_request.id <> v_booking.id
          and coalesce(
            other_request.proposed_starts_at,
            other_slot.starts_at
          ) < candidate.starts_at
            + make_interval(mins => other_service.duration_minutes)
          and coalesce(
            other_request.proposed_starts_at,
            other_slot.starts_at
          ) + make_interval(mins => other_service.duration_minutes)
            > candidate.starts_at
      )
      and not exists (
        select 1
        from unnest(v_assigned_alternatives) as assigned(starts_at)
        where assigned.starts_at < candidate.starts_at
            + make_interval(mins => v_booking.duration_minutes)
          and assigned.starts_at + make_interval(
            mins => v_booking.duration_minutes
          ) > candidate.starts_at
      )
      order by
        case when candidate.starts_at >= v_booking.current_starts_at
          then 0 else 1 end,
        abs(extract(epoch from candidate.starts_at
          - v_booking.current_starts_at)),
        candidate.starts_at
      limit 1;

      if v_alternative is not null then
        v_assigned_alternatives := array_append(
          v_assigned_alternatives,
          v_alternative
        );
      end if;

      v_affected_appointments := v_affected_appointments
        || jsonb_build_array(
          jsonb_build_object(
            'appointment_id', v_booking.id,
            'status', v_booking.status,
            'slot_id', v_booking.slot_id,
            'original_starts_at', v_booking.original_starts_at,
            'current_starts_at', v_booking.current_starts_at,
            'alternative_starts_at', v_alternative
          )
        );
    else
      v_unaffected_appointments := v_unaffected_appointments
        || jsonb_build_array(
          jsonb_build_object(
            'appointment_id', v_booking.id,
            'status', v_booking.status,
            'slot_id', v_booking.slot_id,
            'original_starts_at', v_booking.original_starts_at,
            'current_starts_at', v_booking.current_starts_at
          )
        );
    end if;
  end loop;

  return jsonb_build_object(
    'generated_slot_starts', to_jsonb(v_generated_starts),
    'slots_to_create', v_slots_to_create,
    'slots_to_disable', v_slots_to_disable,
    'affected_appointments', v_affected_appointments,
    'unaffected_appointments', v_unaffected_appointments,
    'affected_count', jsonb_array_length(v_affected_appointments),
    'unaffected_count', jsonb_array_length(v_unaffected_appointments)
  );
end;
$$;

create function private.availability_plan_payload(
  p_plan public.availability_plans
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan_id', p_plan.id,
    'organization_id', p_plan.organization_id,
    'site_id', p_plan.site_id,
    'service_id', p_plan.service_id,
    'status', p_plan.status,
    'base_configuration_revision', p_plan.base_configuration_revision,
    'base_configuration_hash', p_plan.base_configuration_hash,
    'configuration', p_plan.configuration,
    'plan_hash', p_plan.plan_hash,
    'preview', p_plan.preview,
    'preview_hash', p_plan.preview_hash,
    'prepared_by', p_plan.prepared_by,
    'approved_by', p_plan.approved_by,
    'approved_at', p_plan.approved_at,
    'approval_expires_at', p_plan.approval_expires_at,
    'applied_at', p_plan.applied_at,
    'applied_result', p_plan.applied_result
  );
$$;

create function public.get_availability_configuration(
  p_site_id uuid,
  p_service_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_configuration public.clinic_availability_configurations%rowtype;
begin
  select site.organization_id
  into v_organization_id
  from public.sites as site
  join public.clinic_services as service
    on service.site_id = site.id
    and service.organization_id = site.organization_id
  where site.id = p_site_id
    and service.id = p_service_id;

  if v_organization_id is null
    or not private.has_organization_role(v_organization_id) then
    raise insufficient_privilege using
      message = 'availability_configuration_unavailable';
  end if;

  select configuration.*
  into v_configuration
  from public.clinic_availability_configurations as configuration
  where configuration.site_id = p_site_id
    and configuration.service_id = p_service_id;

  if v_configuration.id is null then
    return jsonb_build_object(
      'configured', false,
      'organization_id', v_organization_id,
      'site_id', p_site_id,
      'service_id', p_service_id
    );
  end if;

  return jsonb_build_object(
    'configured', true,
    'configuration_id', v_configuration.id,
    'organization_id', v_configuration.organization_id,
    'site_id', v_configuration.site_id,
    'service_id', v_configuration.service_id,
    'period_start', v_configuration.period_start,
    'period_end', v_configuration.period_end,
    'timezone', v_configuration.timezone,
    'slot_duration_minutes', v_configuration.slot_duration_minutes,
    'weekly_ranges', v_configuration.weekly_rules,
    'recurring_blocks', v_configuration.recurring_blocked_ranges,
    'busy_intervals', v_configuration.busy_intervals,
    'preserve_existing_bookings',
      v_configuration.preserve_existing_bookings,
    'revision', v_configuration.revision,
    'configuration_hash', v_configuration.configuration_hash,
    'updated_at', v_configuration.updated_at
  );
end;
$$;

create function public.prepare_availability_plan(
  p_site_id uuid,
  p_service_id uuid,
  p_configuration jsonb,
  p_prepare_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_configuration public.clinic_availability_configurations%rowtype;
  v_existing_plan public.availability_plans%rowtype;
  v_plan public.availability_plans%rowtype;
  v_normalized_configuration jsonb;
  v_configuration_hash text;
  v_preview jsonb;
  v_preview_hash text;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if p_prepare_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_idempotency_key';
  end if;

  select site.organization_id
  into v_organization_id
  from public.sites as site
  join public.clinic_services as service
    on service.site_id = site.id
    and service.organization_id = site.organization_id
  where site.id = p_site_id
    and service.id = p_service_id;

  if v_organization_id is null
    or not private.has_organization_role(v_organization_id) then
    raise insufficient_privilege using
      message = 'availability_configuration_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_site_id::text || ':' || p_service_id::text,
      0
    )
  );

  v_normalized_configuration :=
    private.normalize_availability_configuration(p_configuration);
  v_configuration_hash :=
    private.availability_hash(v_normalized_configuration);

  select configuration.*
  into v_configuration
  from public.clinic_availability_configurations as configuration
  where configuration.site_id = p_site_id
    and configuration.service_id = p_service_id
  for share;

  select plan.*
  into v_existing_plan
  from public.availability_plans as plan
  where plan.organization_id = v_organization_id
    and plan.prepare_idempotency_key = p_prepare_idempotency_key
  for update;

  if v_existing_plan.id is not null then
    if v_existing_plan.site_id <> p_site_id
      or v_existing_plan.service_id <> p_service_id
      or v_existing_plan.plan_hash <> v_configuration_hash then
      raise exception using
        errcode = '22023',
        message = 'idempotency_key_reused_for_different_plan';
    end if;

    return private.availability_plan_payload(v_existing_plan);
  end if;

  v_preview := private.availability_preview(
    p_site_id,
    p_service_id,
    v_normalized_configuration
  );
  v_preview_hash := private.availability_hash(v_preview);

  insert into public.availability_plans (
    organization_id,
    site_id,
    service_id,
    base_configuration_id,
    base_configuration_revision,
    base_configuration_hash,
    configuration,
    plan_hash,
    preview,
    preview_hash,
    prepare_idempotency_key,
    prepared_by
  ) values (
    v_organization_id,
    p_site_id,
    p_service_id,
    v_configuration.id,
    coalesce(v_configuration.revision, 0),
    v_configuration.configuration_hash,
    v_normalized_configuration,
    v_configuration_hash,
    v_preview,
    v_preview_hash,
    p_prepare_idempotency_key,
    v_actor_user_id
  )
  returning * into v_plan;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_organization_id,
    v_actor_user_id,
    'availability_plan.prepared',
    'availability_plan',
    v_plan.id,
    jsonb_build_object(
      'plan_hash', v_plan.plan_hash,
      'preview_hash', v_plan.preview_hash,
      'base_configuration_revision', v_plan.base_configuration_revision
    )
  );

  return private.availability_plan_payload(v_plan);
end;
$$;

create function public.approve_availability_plan(
  p_plan_id uuid,
  p_expected_revision integer,
  p_plan_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_plan public.availability_plans%rowtype;
  v_configuration public.clinic_availability_configurations%rowtype;
  v_preview jsonb;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select plan.*
  into v_plan
  from public.availability_plans as plan
  where plan.id = p_plan_id
  for update;

  if v_plan.id is null
    or not private.has_organization_role(
      v_plan.organization_id,
      array['owner'::public.organization_role]
    ) then
    raise insufficient_privilege using message = 'availability_plan_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_plan.site_id::text || ':' || v_plan.service_id::text,
      0
    )
  );

  select plan.*
  into v_plan
  from public.availability_plans as plan
  where plan.id = p_plan_id
  for update;

  if v_plan.status = 'approved'
    and v_plan.approved_by = v_actor_user_id
    and v_plan.approved_revision = p_expected_revision
    and v_plan.approved_plan_hash = p_plan_hash then
    return private.availability_plan_payload(v_plan);
  end if;

  if v_plan.status <> 'prepared' then
    raise exception using
      errcode = '22023',
      message = 'availability_plan_not_approvable';
  end if;

  if v_plan.base_configuration_revision <> p_expected_revision
    or v_plan.plan_hash <> p_plan_hash then
    raise exception using
      errcode = 'PT409',
      message = 'availability_plan_revision_conflict';
  end if;

  select configuration.*
  into v_configuration
  from public.clinic_availability_configurations as configuration
  where configuration.site_id = v_plan.site_id
    and configuration.service_id = v_plan.service_id
  for share;

  if coalesce(v_configuration.revision, 0)
      <> v_plan.base_configuration_revision
    or v_configuration.configuration_hash
      is distinct from v_plan.base_configuration_hash then
    raise exception using
      errcode = 'PT409',
      message = 'availability_plan_stale';
  end if;

  v_preview := private.availability_preview(
    v_plan.site_id,
    v_plan.service_id,
    v_plan.configuration
  );

  if private.availability_hash(v_preview) <> v_plan.preview_hash then
    raise exception using
      errcode = 'PT409',
      message = 'availability_plan_stale';
  end if;

  update public.availability_plans
  set status = 'approved',
      approved_by = v_actor_user_id,
      approved_revision = p_expected_revision,
      approved_configuration_hash = v_plan.base_configuration_hash,
      approved_plan_hash = p_plan_hash,
      approved_at = now(),
      approval_expires_at = now() + interval '10 minutes',
      updated_at = now()
  where id = v_plan.id
  returning * into v_plan;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_plan.organization_id,
    v_actor_user_id,
    'availability_plan.approved',
    'availability_plan',
    v_plan.id,
    jsonb_build_object(
      'plan_hash', v_plan.plan_hash,
      'base_configuration_revision', v_plan.base_configuration_revision,
      'base_configuration_hash', v_plan.base_configuration_hash
    )
  );

  return private.availability_plan_payload(v_plan);
end;
$$;

create function public.apply_approved_availability_plan(
  p_plan_id uuid,
  p_expected_revision integer,
  p_plan_hash text,
  p_apply_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_plan public.availability_plans%rowtype;
  v_configuration public.clinic_availability_configurations%rowtype;
  v_preview jsonb;
  v_item jsonb;
  v_request public.appointment_requests%rowtype;
  v_alternative_slot public.appointment_slots%rowtype;
  v_original_starts_at timestamptz;
  v_alternative_starts_at timestamptz;
  v_request_id uuid;
  v_generated_start timestamptz;
  v_configuration_revision integer;
  v_configuration_id uuid;
  v_plan_period_start date;
  v_plan_period_end date;
  v_plan_timezone text;
  v_slots_created jsonb := '[]'::jsonb;
  v_notifications jsonb := '[]'::jsonb;
  v_applied_result jsonb;
  v_slot_was_missing boolean;
begin
  if v_actor_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if p_apply_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_idempotency_key';
  end if;

  select plan.*
  into v_plan
  from public.availability_plans as plan
  where plan.id = p_plan_id;

  if v_plan.id is null
    or not private.has_organization_role(
      v_plan.organization_id,
      array['owner'::public.organization_role]
    ) then
    raise insufficient_privilege using message = 'availability_plan_unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_plan.site_id::text || ':' || v_plan.service_id::text,
      0
    )
  );

  select plan.*
  into v_plan
  from public.availability_plans as plan
  where plan.id = p_plan_id
  for update;

  v_plan_period_start := (v_plan.configuration ->> 'period_start')::date;
  v_plan_period_end := (v_plan.configuration ->> 'period_end')::date;
  v_plan_timezone := v_plan.configuration ->> 'timezone';

  if v_plan.status = 'applied'
    and v_plan.apply_idempotency_key = p_apply_idempotency_key then
    return v_plan.applied_result;
  end if;

  if exists (
    select 1
    from public.availability_plans as other_plan
    where other_plan.organization_id = v_plan.organization_id
      and other_plan.apply_idempotency_key = p_apply_idempotency_key
      and other_plan.id <> v_plan.id
  ) then
    raise exception using
      errcode = '22023',
      message = 'idempotency_key_reused_for_different_plan';
  end if;

  if v_plan.status = 'applied' then
    raise exception using
      errcode = '22023',
      message = 'availability_plan_already_applied';
  end if;

  if v_plan.status <> 'approved'
    or v_plan.approval_expires_at is null
    or v_plan.approval_expires_at <= now()
    or v_plan.approved_revision is distinct from p_expected_revision
    or v_plan.approved_plan_hash is distinct from p_plan_hash
    or v_plan.base_configuration_revision <> p_expected_revision
    or v_plan.plan_hash <> p_plan_hash then
    raise exception using
      errcode = '22023',
      message = 'availability_approval_invalid_or_expired';
  end if;

  select configuration.*
  into v_configuration
  from public.clinic_availability_configurations as configuration
  where configuration.site_id = v_plan.site_id
    and configuration.service_id = v_plan.service_id
  for update;

  if coalesce(v_configuration.revision, 0)
      <> v_plan.base_configuration_revision
    or v_configuration.configuration_hash
      is distinct from v_plan.base_configuration_hash then
    raise exception using
      errcode = 'PT409',
      message = 'availability_plan_stale';
  end if;

  v_preview := private.availability_preview(
    v_plan.site_id,
    v_plan.service_id,
    v_plan.configuration
  );

  if private.availability_hash(v_preview) <> v_plan.preview_hash then
    raise exception using
      errcode = 'PT409',
      message = 'availability_plan_stale';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      v_preview -> 'affected_appointments'
    ) as affected(value)
    where affected.value ->> 'alternative_starts_at' is null
  ) then
    raise exception using
      errcode = 'PT409',
      message = 'no_valid_availability_alternative';
  end if;

  if v_configuration.id is null then
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
      v_plan.organization_id,
      v_plan.site_id,
      v_plan.service_id,
      (v_plan.configuration ->> 'period_start')::date,
      (v_plan.configuration ->> 'period_end')::date,
      v_plan.configuration ->> 'timezone',
      (v_plan.configuration ->> 'slot_duration_minutes')::smallint,
      v_plan.configuration -> 'weekly_ranges',
      v_plan.configuration -> 'recurring_blocks',
      v_plan.configuration -> 'busy_intervals',
      (v_plan.configuration ->> 'preserve_existing_bookings')::boolean,
      1,
      private.availability_hash(v_plan.configuration)
    )
    returning id, revision into v_configuration_id, v_configuration_revision;
  else
    update public.clinic_availability_configurations
    set period_start = (v_plan.configuration ->> 'period_start')::date,
        period_end = (v_plan.configuration ->> 'period_end')::date,
        timezone = v_plan.configuration ->> 'timezone',
        slot_duration_minutes =
          (v_plan.configuration ->> 'slot_duration_minutes')::smallint,
        weekly_rules = v_plan.configuration -> 'weekly_ranges',
        recurring_blocked_ranges =
          v_plan.configuration -> 'recurring_blocks',
        busy_intervals = v_plan.configuration -> 'busy_intervals',
        preserve_existing_bookings =
          (v_plan.configuration ->> 'preserve_existing_bookings')::boolean,
        revision = v_configuration.revision + 1,
        configuration_hash = private.availability_hash(v_plan.configuration),
        updated_at = now()
    where id = v_configuration.id
    returning id, revision into v_configuration_id, v_configuration_revision;
  end if;

  update public.appointment_slots
  set available = false
  where organization_id = v_plan.organization_id
    and site_id = v_plan.site_id
    and service_id = v_plan.service_id
    and (starts_at at time zone v_plan_timezone)::date
      between v_plan_period_start and v_plan_period_end;

  for v_generated_start in
    select value::timestamptz
    from pg_catalog.jsonb_array_elements_text(
      v_preview -> 'generated_slot_starts'
    )
  loop
    select not exists (
      select 1
      from public.appointment_slots as slot
      where slot.site_id = v_plan.site_id
        and slot.service_id = v_plan.service_id
        and slot.starts_at = v_generated_start
    )
    into v_slot_was_missing;

    insert into public.appointment_slots (
      organization_id,
      site_id,
      service_id,
      starts_at,
      available
    ) values (
      v_plan.organization_id,
      v_plan.site_id,
      v_plan.service_id,
      v_generated_start,
      true
    )
    on conflict (site_id, service_id, starts_at)
    do update set available = true;

    if v_slot_was_missing then
      select slot.*
      into v_alternative_slot
      from public.appointment_slots as slot
      where slot.site_id = v_plan.site_id
        and slot.service_id = v_plan.service_id
        and slot.starts_at = v_generated_start;

      v_slots_created := v_slots_created || jsonb_build_array(
        jsonb_build_object(
          'slot_id', v_alternative_slot.id,
          'starts_at', v_generated_start
        )
      );
    end if;
  end loop;

  update public.appointment_slots as slot
  set available = false
  where slot.site_id = v_plan.site_id
    and slot.service_id = v_plan.service_id
    and (
      exists (
        select 1
        from public.appointment_requests as request
      where request.slot_id = slot.id
          and (
            slot.starts_at at time zone v_plan_timezone
          )::date between v_plan_period_start and v_plan_period_end
          and request.status in (
            'requested'::public.appointment_request_status,
            'confirmed'::public.appointment_request_status,
            'time_proposed'::public.appointment_request_status
          )
      )
      or exists (
        select 1
        from public.appointment_requests as request
        where request.site_id = v_plan.site_id
          and request.service_id = v_plan.service_id
          and request.status in (
            'requested'::public.appointment_request_status,
            'confirmed'::public.appointment_request_status,
            'time_proposed'::public.appointment_request_status
          )
          and request.proposed_starts_at = slot.starts_at
          and (
            request.proposed_starts_at at time zone v_plan_timezone
          )::date between v_plan_period_start and v_plan_period_end
      )
    );

  for v_item in
    select value
    from pg_catalog.jsonb_array_elements(
      v_preview -> 'affected_appointments'
    )
  loop
    v_request_id := (v_item ->> 'appointment_id')::uuid;
    v_alternative_starts_at :=
      (v_item ->> 'alternative_starts_at')::timestamptz;

    select request.*
    into v_request
    from public.appointment_requests as request
    where request.id = v_request_id
      and request.site_id = v_plan.site_id
      and request.service_id = v_plan.service_id
    for update;

    if v_request.id is null then
      raise exception using
        errcode = 'PT409',
        message = 'availability_plan_stale';
    end if;

    select slot.*
    into v_alternative_slot
    from public.appointment_slots as slot
    where slot.site_id = v_plan.site_id
      and slot.service_id = v_plan.service_id
      and slot.starts_at = v_alternative_starts_at
    for update;

    if v_alternative_slot.id is null or not v_alternative_slot.available then
      raise exception using
        errcode = 'PT409',
        message = 'no_valid_availability_alternative';
    end if;

    select slot.starts_at
    into v_original_starts_at
    from public.appointment_slots as slot
    where slot.id = v_request.slot_id;

    update public.appointment_slots
    set available = false
    where id = v_alternative_slot.id;

    update public.appointment_requests
    set status = 'time_proposed',
        proposed_starts_at = v_alternative_starts_at,
        updated_at = now()
    where id = v_request.id;

    v_notifications := v_notifications || jsonb_build_array(
      jsonb_build_object(
        'appointment_id', v_request.id,
        'customer_email', v_request.customer_email,
        'pet_name', v_request.pet_name,
        'access_token', v_request.access_token,
        'original_starts_at', v_original_starts_at,
        'proposed_starts_at', v_alternative_starts_at,
        'alternative_slot_id', v_alternative_slot.id,
        'status', 'time_proposed'
      )
    );
  end loop;

  v_applied_result := jsonb_build_object(
    'status', 'applied',
    'plan_id', v_plan.id,
    'organization_id', v_plan.organization_id,
    'site_id', v_plan.site_id,
    'service_id', v_plan.service_id,
    'configuration_id', v_configuration_id,
    'configuration_revision', v_configuration_revision,
    'plan_hash', v_plan.plan_hash,
    'generated_slot_starts', v_preview -> 'generated_slot_starts',
    'slots_created', v_slots_created,
    'slots_disabled', v_preview -> 'slots_to_disable',
    'affected_appointments', v_notifications,
    'unaffected_appointments',
      v_preview -> 'unaffected_appointments',
    'customer_notifications', v_notifications
  );

  update public.availability_plans
  set status = 'applied',
      applied_by = v_actor_user_id,
      applied_at = now(),
      consumed_at = now(),
      apply_idempotency_key = p_apply_idempotency_key,
      applied_result = v_applied_result,
      updated_at = now()
  where id = v_plan.id;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_plan.organization_id,
    v_actor_user_id,
    'availability_plan.applied',
    'availability_plan',
    v_plan.id,
    jsonb_build_object(
      'plan_hash', v_plan.plan_hash,
      'configuration_revision', v_configuration_revision,
      'affected_count',
        jsonb_array_length(v_notifications),
      'unaffected_count',
        jsonb_array_length(v_preview -> 'unaffected_appointments')
    )
  );

  return v_applied_result;
end;
$$;

create or replace function public.respond_to_appointment_proposal(
  p_request_id uuid,
  p_access_token uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.appointment_requests%rowtype;
  v_hold_slot public.appointment_slots%rowtype;
  v_original_slot public.appointment_slots%rowtype;
  v_configuration public.clinic_availability_configurations%rowtype;
  v_original_can_reopen boolean := false;
  v_action text;
begin
  select request.*
  into v_request
  from public.appointment_requests as request
  where request.id = p_request_id
    and request.access_token = p_access_token
  for update;

  if v_request.id is null
    or v_request.status <> 'time_proposed'
    or v_request.proposed_starts_at is null then
    raise exception using
      errcode = '22023',
      message = 'appointment_proposal_unavailable';
  end if;

  select slot.*
  into v_hold_slot
  from public.appointment_slots as slot
  where slot.site_id = v_request.site_id
    and slot.service_id = v_request.service_id
    and slot.starts_at = v_request.proposed_starts_at
  for update;

  if v_hold_slot.id is null then
    raise exception using
      errcode = 'PT409',
      message = 'appointment_proposal_hold_missing';
  end if;

  if p_accept then
    select slot.*
    into v_original_slot
    from public.appointment_slots as slot
    where slot.id = v_request.slot_id
    for update;

    if v_original_slot.id is null then
      raise exception using
        errcode = 'PT409',
        message = 'appointment_proposal_unavailable';
    end if;

    select configuration.*
    into v_configuration
    from public.clinic_availability_configurations as configuration
    where configuration.site_id = v_request.site_id
      and configuration.service_id = v_request.service_id;

    if v_configuration.id is not null then
      select exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          private.availability_preview(
            v_request.site_id,
            v_request.service_id,
            jsonb_build_object(
              'period_start', v_configuration.period_start,
              'period_end', v_configuration.period_end,
              'timezone', v_configuration.timezone,
              'slot_duration_minutes',
                v_configuration.slot_duration_minutes,
              'weekly_ranges', v_configuration.weekly_rules,
              'recurring_blocks',
                v_configuration.recurring_blocked_ranges,
              'busy_intervals', v_configuration.busy_intervals,
              'preserve_existing_bookings',
                v_configuration.preserve_existing_bookings
            )
          ) -> 'generated_slot_starts'
        ) as generated(starts_at)
        where generated.starts_at::timestamptz = v_original_slot.starts_at
      )
      into v_original_can_reopen;
    end if;

    update public.appointment_slots
    set available = false
    where id = v_hold_slot.id;

    update public.appointment_requests
    set status = 'confirmed',
        slot_id = v_hold_slot.id,
        proposed_starts_at = null,
        confirmed_at = now(),
        updated_at = now()
    where id = v_request.id;

    if v_original_can_reopen
      and not exists (
        select 1
        from public.appointment_requests as other_request
        where other_request.id <> v_request.id
          and other_request.slot_id = v_original_slot.id
          and other_request.status in (
            'requested'::public.appointment_request_status,
            'confirmed'::public.appointment_request_status,
            'time_proposed'::public.appointment_request_status
          )
      ) then
      update public.appointment_slots
      set available = true
      where id = v_original_slot.id;
    end if;

    v_action := 'appointment.proposal_accepted';
  else
    update public.appointment_slots as slot
    set available = true
    where slot.id = v_hold_slot.id
      and not exists (
        select 1
        from public.appointment_requests as other_request
        join public.appointment_slots as other_original_slot
          on other_original_slot.id = other_request.slot_id
        where other_request.id <> v_request.id
          and other_request.site_id = v_request.site_id
          and other_request.service_id = v_request.service_id
          and other_request.status in (
            'requested'::public.appointment_request_status,
            'confirmed'::public.appointment_request_status,
            'time_proposed'::public.appointment_request_status
          )
          and coalesce(
            other_request.proposed_starts_at,
            other_original_slot.starts_at
          ) = v_hold_slot.starts_at
      );

    if not found then
      raise exception using
        errcode = 'PT409',
        message = 'appointment_proposal_hold_unavailable';
    end if;

    update public.appointment_requests
    set status = 'declined',
        proposed_starts_at = null,
        confirmed_at = null,
        updated_at = now()
    where id = v_request.id;

    v_action := 'appointment.proposal_declined';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_request.organization_id,
    null,
    v_action,
    'appointment_request',
    v_request.id,
    jsonb_build_object(
      'accepted', p_accept,
      'proposed_starts_at', v_request.proposed_starts_at
    )
  );

  return public.get_appointment_status(v_request.id, v_request.access_token);
end;
$$;

revoke all on table public.clinic_availability_configurations
  from public, anon, authenticated;
revoke all on table public.availability_plans
  from public, anon, authenticated;
grant select on table public.clinic_availability_configurations
  to authenticated;
grant select on table public.availability_plans
  to authenticated;
grant select, update on table public.availability_plans
  to service_role;

revoke all on function private.normalize_availability_configuration(jsonb)
  from public;
revoke all on function private.availability_hash(jsonb)
  from public;
revoke all on function private.availability_preview(uuid, uuid, jsonb)
  from public;
revoke all on function private.availability_plan_payload(public.availability_plans)
  from public;

revoke all on function public.get_availability_configuration(uuid, uuid)
  from public;
revoke all on function public.prepare_availability_plan(uuid, uuid, jsonb, uuid)
  from public;
revoke all on function public.approve_availability_plan(uuid, integer, text)
  from public;
revoke all on function public.apply_approved_availability_plan(uuid, integer, text, uuid)
  from public;
revoke all on function public.respond_to_appointment_proposal(uuid, uuid, boolean)
  from public;

grant execute on function public.get_availability_configuration(uuid, uuid)
  to authenticated;
grant execute on function public.prepare_availability_plan(uuid, uuid, jsonb, uuid)
  to authenticated;
grant execute on function public.approve_availability_plan(uuid, integer, text)
  to authenticated;
grant execute on function public.apply_approved_availability_plan(
  uuid,
  integer,
  text,
  uuid
) to authenticated;
grant execute on function public.respond_to_appointment_proposal(uuid, uuid, boolean)
  to anon, authenticated;

comment on table public.clinic_availability_configurations is
  'Current tenant-owned weekly availability, recurring blocks, and normalized external busy intervals.';
comment on table public.availability_plans is
  'Exact, hash-bound availability previews and one-shot owner approvals.';
comment on function public.prepare_availability_plan(uuid, uuid, jsonb, uuid) is
  'Persists a server-derived availability plan without changing slots or sending notifications. Configuration keys are period_start, period_end, timezone, slot_duration_minutes, weekly_ranges, recurring_blocks, busy_intervals, and preserve_existing_bookings; weekly ranges use day_of_week 0=Sunday through 6=Saturday.';
comment on function public.apply_approved_availability_plan(uuid, integer, text, uuid) is
  'Atomically applies an exact owner-approved plan, preserves existing bookings, holds derived alternatives, and returns post-commit notification data without sending email.';

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
  v_luna_slot_id uuid;
  v_max_slot_id uuid;
  v_today_lima date;
  v_next_saturday date;
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
      ),
      (
        v_sandbox.organization_id,
        v_site_id,
        'vaccination-review',
        'Vaccination review',
        'Review the current schedule and prepare the next recommended step.',
        20
      );

    v_today_lima := (now() at time zone 'America/Lima')::date;
    v_next_saturday := v_today_lima
      + case
          when 6 - extract(isodow from v_today_lima)::integer <= 0
            then 13 - extract(isodow from v_today_lima)::integer
          else 6 - extract(isodow from v_today_lima)::integer
        end;

    v_availability := jsonb_build_object(
      'period_start', v_next_saturday,
      'period_end', v_next_saturday + 6,
      'timezone', 'America/Lima',
      'slot_duration_minutes', 30,
      'weekly_ranges', jsonb_build_array(
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

create or replace function public.refresh_demo_fixtures()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sandbox public.demo_sandboxes%rowtype;
  v_refreshed integer := 0;
begin
  for v_sandbox in
    select *
    from public.demo_sandboxes
    where enabled
    order by slot_number
  loop
    perform private.reset_demo_sandbox(v_sandbox.id);
    v_refreshed := v_refreshed + 1;
  end loop;

  return v_refreshed;
end;
$$;

revoke all on function public.refresh_demo_fixtures() from public;
grant execute on function public.refresh_demo_fixtures() to service_role;

comment on function private.reset_demo_sandbox(uuid) is
  'Restores a deterministic fictional availability demo with Luna confirmed at 10:00, Max confirmed at 12:00, and a 30-minute dermatology service on the next Saturday in America/Lima.';
comment on function public.refresh_demo_fixtures() is
  'Service-only reset for deterministic Luna and Max availability fixtures in every enabled sandbox.';
