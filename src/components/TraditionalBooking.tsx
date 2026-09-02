"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { prepareAppointmentFromPage } from "@/features/appointments/server/actions";

type AppointmentSlot = {
  duration_minutes: number;
  slot_id: string;
  starts_at: string;
};

type TraditionalBookingProps = {
  appointmentDate: string;
  bookingError?: string;
  initialCustomerEmail?: string;
  initialOpen?: boolean;
  initialPetName?: string;
  initialStartsAt?: string;
  siteSlug: string;
  slots: AppointmentSlot[];
};

function slotTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export function TraditionalBooking({
  appointmentDate,
  bookingError,
  initialCustomerEmail = "",
  initialOpen = false,
  initialPetName = "",
  initialStartsAt,
  siteSlug,
  slots,
}: TraditionalBookingProps) {
  const restoredSlot = slots.find((slot) => slot.starts_at === initialStartsAt)?.slot_id;
  const [open, setOpen] = useState(initialOpen);
  const [selectedSlot, setSelectedSlot] = useState(restoredSlot ?? slots[0]?.slot_id ?? "");
  const [petName, setPetName] = useState(initialPetName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [errors, setErrors] = useState<{ customerEmail?: string; petName?: string }>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const petNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const panelId = `traditional-booking-${siteSlug}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function reviewRequest(event: FormEvent<HTMLFormElement>) {
    const nextErrors: { customerEmail?: string; petName?: string } = {};
    const normalizedName = petName.trim();
    const normalizedEmail = customerEmail.trim();

    if (!normalizedName) nextErrors.petName = "Enter your pet's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.customerEmail = "Enter a valid email for appointment updates.";
    }

    if (Object.keys(nextErrors).length) {
      event.preventDefault();
      setErrors(nextErrors);
      window.requestAnimationFrame(() => {
        if (nextErrors.petName) petNameRef.current?.focus();
        else emailRef.current?.focus();
      });
      return;
    }

    setErrors({});
  }

  return (
    <section className="clinic-human-booking">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="clinic-human-booking-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>
          <strong>Book it manually by clicking here</strong>
        </span>
        <em>
          {slots.length
            ? `${slots.length} live ${slots.length === 1 ? "time" : "times"} · Open form`
            : "No times available"}
          <span className="clinic-inline-arrow" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </em>
      </button>

      <dialog
        aria-labelledby={`${panelId}-title`}
        className="clinic-human-booking-dialog"
        id={panelId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <div className="clinic-human-booking-dialog-card">
          <header>
            <div>
              <span>Book manually</span>
              <h2 id={`${panelId}-title`}>Choose your appointment time.</h2>
              <p>Dermatology · {appointmentDate}</p>
            </div>
            <button
              aria-label="Close booking form"
              className="clinic-human-booking-dialog-close"
              onClick={() => setOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>

          <div className="clinic-human-booking-body">
            <p>If one of these times already works, book it here. Otherwise, let your AI agent compare them with your calendar and preferences.</p>
            {bookingError ? (
              <p className="clinic-booking-error">
                {bookingError === "confirm"
                  ? "That time is no longer available. Start a new request."
                  : "The request could not be prepared. Check the details and try again."}
              </p>
            ) : null}
            {slots.length ? (
              <form action={prepareAppointmentFromPage} noValidate onSubmit={reviewRequest}>
                <input name="siteSlug" type="hidden" value={siteSlug} />
                <input name="serviceSlug" type="hidden" value="dermatology" />
                <fieldset>
                  <legend>Available times</legend>
                  <div className="clinic-slot-options">
                    {slots.map((slot) => (
                      <label key={slot.slot_id}>
                        <input
                          checked={selectedSlot === slot.slot_id}
                          name="slotId"
                          onChange={() => setSelectedSlot(slot.slot_id)}
                          type="radio"
                          value={slot.slot_id}
                        />
                        <span>{slotTime(slot.starts_at)}</span>
                        <small>{slot.duration_minutes} min</small>
                        <i aria-hidden="true">✓</i>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="clinic-booking-fields">
                  <label>
                    Pet name
                    <input
                      aria-describedby={errors.petName ? "pet-name-error" : undefined}
                      aria-invalid={Boolean(errors.petName)}
                      maxLength={80}
                      name="petName"
                      autoComplete="off"
                      onChange={(event) => {
                        setPetName(event.target.value);
                        if (errors.petName) setErrors((value) => ({ ...value, petName: undefined }));
                      }}
                      placeholder="Luna"
                      ref={petNameRef}
                      value={petName}
                    />
                    <small className="clinic-field-error" id="pet-name-error">{errors.petName}</small>
                  </label>
                  <label>
                    Email for updates
                    <input
                      aria-describedby={errors.customerEmail ? "customer-email-error" : undefined}
                      aria-invalid={Boolean(errors.customerEmail)}
                      inputMode="email"
                      maxLength={200}
                      name="customerEmail"
                      autoComplete="email"
                      onChange={(event) => {
                        setCustomerEmail(event.target.value);
                        if (errors.customerEmail) setErrors((value) => ({ ...value, customerEmail: undefined }));
                      }}
                      placeholder="you@example.com"
                      ref={emailRef}
                      type="email"
                      value={customerEmail}
                    />
                    <small className="clinic-field-error" id="customer-email-error">{errors.customerEmail}</small>
                  </label>
                </div>
                <button className="clinic-primary-cta" type="submit">
                  Review appointment request
                  <span className="clinic-cta-arrow" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </span>
                </button>
              </form>
            ) : <p>No dermatology times are currently available.</p>}
          </div>
        </div>
      </dialog>
    </section>
  );
}
