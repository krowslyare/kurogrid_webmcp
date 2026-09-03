"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

type LiveAppointmentSyncProps = {
  organizationId: string;
  organizationSlug: string;
  initialStateKey: string;
};

interface RealtimePayloadRecord {
  status?: string;
  pet_name?: string;
}

interface RealtimeChangePayload {
  new?: RealtimePayloadRecord;
}

export function LiveAppointmentSync({
  organizationId,
  organizationSlug,
  initialStateKey,
}: LiveAppointmentSyncProps) {
  const router = useRouter();
  const lastStateKey = useRef(initialStateKey);
  const knownStatuses = useRef<Record<string, { status: string; petName: string }>>({});
  const notifiedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    lastStateKey.current = initialStateKey;
  }, [initialStateKey]);

  useEffect(() => {
    let isSubscribed = true;

    // 1. Supabase Realtime channel
    const supabase = createClient();
    const channel = supabase
      .channel(`live-sync-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_requests",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: RealtimeChangePayload) => {
          if (!isSubscribed) return;
          const newRow = payload?.new;
          if (newRow?.status === "confirmed" && newRow?.pet_name) {
            const eventKey = `${newRow.pet_name}:confirmed`;
            if (!notifiedEvents.current.has(eventKey)) {
              notifiedEvents.current.add(eventKey);
              toast.success(`${newRow.pet_name} confirmed appointment!`, {
                description: "Customer accepted the proposed alternative. Operational schedule updated.",
              });
            }
          }
          router.refresh();
        },
      )
      .subscribe();

    // 2. Gentle polling fallback (every 3.5 seconds when page is visible)
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible" || !isSubscribed) return;

      try {
        const res = await fetch(
          `/api/appointments/sync?organizationSlug=${encodeURIComponent(organizationSlug)}`,
        );
        if (!res.ok) return;

        const data = (await res.json()) as {
          appointments?: Array<{
            id: string;
            status: string;
            pet_name: string;
            proposed_starts_at?: string;
          }>;
        };
        const appointments = data.appointments ?? [];
        const currentKey = appointments
          .map((a) => `${a.id}:${a.status}:${a.proposed_starts_at ?? ""}`)
          .join("|");

        if (lastStateKey.current && currentKey !== lastStateKey.current) {
          // Detect which appointment flipped to confirmed
          for (const appt of appointments) {
            const prev = knownStatuses.current[appt.id];
            if (prev && prev.status !== "confirmed" && appt.status === "confirmed") {
              const eventKey = `${appt.pet_name}:confirmed`;
              if (!notifiedEvents.current.has(eventKey)) {
                notifiedEvents.current.add(eventKey);
                toast.success(`${appt.pet_name} confirmed appointment!`, {
                  description: "Customer accepted the proposed alternative. Operational schedule updated.",
                });
              }
            }
            knownStatuses.current[appt.id] = { status: appt.status, petName: appt.pet_name };
          }

          lastStateKey.current = currentKey;
          router.refresh();
        } else {
          for (const appt of appointments) {
            knownStatuses.current[appt.id] = { status: appt.status, petName: appt.pet_name };
          }
        }
      } catch {
        // Quiet fail on network interruption
      }
    }, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, organizationSlug, router]);

  return null;
}
