-- A single service-date query now covers a full operating day instead of
-- silently truncating after six rows. The longest seeded day (09:00-18:00)
-- holds 18 thirty-minute slots and 27 twenty-minute slots; 30 leaves room
-- for a full day without opening an unbounded listing surface. Both the
-- public booking dialog and the agent tool read through this function, so
-- human visitors and assistants keep seeing the same availability.

create or replace function public.find_appointment_slots(
  p_site_slug text,
  p_service_slug text,
  p_date date
)
returns table (
  slot_id uuid,
  starts_at timestamptz,
  duration_minutes smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select slot.id, slot.starts_at, service.duration_minutes
  from public.sites as site
  join public.clinic_services as service on service.site_id = site.id
  join public.appointment_slots as slot on slot.service_id = service.id
  where site.slug = p_site_slug
    and site.published_version_id is not null
    and service.slug = p_service_slug
    and service.active
    and slot.available
    and slot.starts_at >= now()
    and (slot.starts_at at time zone 'America/Lima')::date = p_date
  order by slot.starts_at
  limit 30;
$$;
