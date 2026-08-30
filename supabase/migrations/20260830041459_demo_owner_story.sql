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
  v_version_id uuid;
  v_dermatology_id uuid;
  v_next_saturday date;
begin
  select * into v_sandbox
  from public.demo_sandboxes
  where id = p_sandbox_id;

  if v_sandbox.id is null then
    raise exception using errcode = '22023', message = 'sandbox_unavailable';
  end if;

  select id into v_site_id
  from public.sites
  where organization_id = v_sandbox.organization_id
  order by created_at
  limit 1;

  if v_site_id is not null then
    delete from public.appointment_requests where site_id = v_site_id;
    delete from public.appointment_slots where site_id = v_site_id;
    delete from public.clinic_services where site_id = v_site_id;
    update public.sites set published_version_id = null where id = v_site_id;
    delete from public.publication_operations where site_id = v_site_id;
    delete from public.publish_approvals where site_id = v_site_id;
    delete from public.site_versions where site_id = v_site_id;
    delete from public.site_drafts where site_id = v_site_id;
  end if;

  delete from public.action_plan_steps where organization_id = v_sandbox.organization_id;
  delete from public.action_plans where organization_id = v_sandbox.organization_id;
  delete from public.attention_items where organization_id = v_sandbox.organization_id;
  delete from public.audit_events where organization_id = v_sandbox.organization_id;

  insert into public.attention_items (organization_id, kind, title, summary, evidence)
  values
    (
      v_sandbox.organization_id,
      'synthetic_lead',
      'Saturday appointment requests need attention',
      'A fictional pet owner requested dermatology care on Saturday morning.',
      jsonb_build_object('source', 'synthetic_fixture', 'contains_pii', false)
    ),
    (
      v_sandbox.organization_id,
      'analytics_snapshot',
      'Weekend demand is growing',
      'The fictional seven-day snapshot shows twice as much weekend appointment intent.',
      jsonb_build_object('source', 'synthetic_fixture', 'period', '7d', 'weekend_interest_count', 18, 'weekday_interest_count', 9)
    ),
    (
      v_sandbox.organization_id,
      'verified_fact',
      'Saturday coverage is approved',
      'The clinic can accept selected Saturday appointments from 09:00 to 14:00.',
      jsonb_build_object('source', 'synthetic_fixture', 'fact', 'saturday_hours', 'value', '09:00–14:00', 'verified', true)
    );

  if v_site_id is not null then
    insert into public.site_versions (
      organization_id, site_id, version_number, source_draft_revision,
      content, content_hash, published_by
    ) values (
      v_sandbox.organization_id, v_site_id, 1, 1,
      v_initial_content, private.site_content_hash(v_initial_content),
      v_sandbox.owner_user_id
    ) returning id into v_version_id;

    update public.sites set published_version_id = v_version_id where id = v_site_id;

    insert into public.clinic_services (
      organization_id, site_id, slug, name, description, duration_minutes
    ) values
      (v_sandbox.organization_id, v_site_id, 'dermatology', 'Dermatology consultation', 'Focused care for skin, coat, ear, and allergy concerns.', 30)
      returning id into v_dermatology_id;

    insert into public.clinic_services (
      organization_id, site_id, slug, name, description, duration_minutes
    ) values
      (v_sandbox.organization_id, v_site_id, 'wellness-exam', 'Wellness exam', 'A calm preventive check-in for every life stage.', 30),
      (v_sandbox.organization_id, v_site_id, 'vaccination-review', 'Vaccination review', 'Review the current schedule and prepare the next recommended step.', 20);

    v_next_saturday := current_date
      + (case when 6 - extract(isodow from current_date)::integer <= 0
              then 13 - extract(isodow from current_date)::integer
              else 6 - extract(isodow from current_date)::integer end);

    insert into public.appointment_slots (
      organization_id, site_id, service_id, starts_at
    ) values
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '09:30') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '10:30') at time zone 'America/Lima'),
      (v_sandbox.organization_id, v_site_id, v_dermatology_id, (v_next_saturday + time '11:30') at time zone 'America/Lima');
  end if;
end;
$$;

comment on function private.reset_demo_sandbox(uuid) is
  'Restores a fictional pre-campaign site so the Owner demo publishes a visible Saturday-care message while preserving valid Saturday booking data.';
