import { createClient } from "@/lib/supabase/server";

function escapeCalendar(value: string) {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

function calendarStamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appointment = url.searchParams.get("appointment");
  const access = url.searchParams.get("access");

  if (!appointment || !access) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_appointment_status", {
    p_request_id: appointment,
    p_access_token: access,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return new Response("Not found", { status: 404 });
  }

  const details = data as Record<string, unknown>;
  if (details.status !== "confirmed") {
    return new Response("Appointment is not confirmed", { status: 409 });
  }

  const startsAt = new Date(String(details.starts_at));
  const endsAt = new Date(startsAt.getTime() + Number(details.duration_minutes) * 60_000);
  const title = `${String(details.service)} for ${String(details.pet_name)} · Arboleda`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kuro Agent//Arboleda Appointment//EN",
    "BEGIN:VEVENT",
    `UID:${appointment}@kurogrid-webmcp`,
    `DTSTAMP:${calendarStamp(new Date())}`,
    `DTSTART:${calendarStamp(startsAt)}`,
    `DTEND:${calendarStamp(endsAt)}`,
    `SUMMARY:${escapeCalendar(title)}`,
    "LOCATION:Clínica Veterinaria Arboleda",
    "DESCRIPTION:Confirmed through Arboleda's WebMCP appointment flow.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arboleda-appointment.ics"',
    },
  });
}
