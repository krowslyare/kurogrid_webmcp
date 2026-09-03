"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const NOTICE_COPY: Record<string, { kind: "success" | "error"; title: string; body: string; target: string }> = {
  prepared: {
    kind: "success",
    title: "Plan prepared by hand.",
    body: "Review the impact above, then approve it below.",
    target: "availability-review",
  },
  approved: {
    kind: "success",
    title: "Approval recorded.",
    body: "The exact plan is approved; apply it yourself below or ask your agent.",
    target: "availability-review",
  },
  applied: {
    kind: "success",
    title: "Plan applied.",
    body: "The busy range is blocked and the customer update was prepared.",
    target: "availability-receipt",
  },
  prepare_error: {
    kind: "error",
    title: "Plan could not be prepared.",
    body: "Check dates, times, and busy ranges, then retry.",
    target: "availability-manual",
  },
  approval_error: {
    kind: "error",
    title: "Approval could not be recorded.",
    body: "The plan remains unchanged; refresh it before retrying.",
    target: "availability-review",
  },
  apply_error: {
    kind: "error",
    title: "Apply could not be completed.",
    body: "The plan is unchanged; refresh it before retrying.",
    target: "availability-manual",
  },
};

// Server actions redirect with ?availability=<notice>; this client hook turns
// that transient query param into an explicit toast so every step announces
// itself instead of just blinking the page.
export function AvailabilityNoticeToast() {
  const searchParams = useSearchParams();
  const notice = searchParams.get("availability");
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!notice || seen.current === notice) return;
    seen.current = notice;

    const copy = NOTICE_COPY[notice];
    if (!copy) return;

    if (copy.kind === "success") toast.success(copy.title, { description: copy.body });
    else toast.error(copy.title, { description: copy.body });

    // The redirect lands at the top of the page; bring the section that
    // changed into view so the step sequence reads top-to-bottom.
    window.requestAnimationFrame(() => {
      document.getElementById(copy.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [notice]);

  return null;
}
