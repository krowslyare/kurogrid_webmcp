"use client";

import { useFormStatus } from "react-dom";

import styles from "./availability-control-room.module.css";

type ManualSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
};

// useFormStatus only works inside a <form>, so each manual step gets its own
// pending-aware submit button: disabled + explicit label while the server
// action round-trips, instead of a silent blink.
export function ManualSubmitButton({ idleLabel, pendingLabel }: ManualSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className={styles.approveButton}
      disabled={pending}
      type="submit"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
