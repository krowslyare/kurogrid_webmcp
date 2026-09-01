"use client";

import { FormEvent, useRef, useState } from "react";

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
  const petNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const panelId = `traditional-booking-${siteSlug}`;

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
    <section className={`clinic-human-booking${open ? " is-open" : ""}`}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="clinic-human-booking-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>
          <small>Prefer not to use an assistant?</small>
          <strong>Book traditionally on this page</strong>
        </span>
        <em>
          {slots.length
            ? `${slots.length} live ${slots.length === 1 ? "time" : "times"} · ${open ? "Close form" : "Open form"}`
            : "No times available"}
          <i aria-hidden="true">⌄</i>
        </em>
      </button>

      <div
        aria-hidden={!open}
        className="clinic-human-booking-panel"
        id={panelId}
        inert={!open}
      >
        <div className="clinic-human-booking-body">
          <p>The form and your assistant use the same published services and availability. Either way, you review before sending.</p>
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
                <legend>Dermatology · {appointmentDate}</legend>
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
                Review appointment request <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : <p>No dermatology times are currently available.</p>}
        </div>
      </div>
    </section>
  );
}
