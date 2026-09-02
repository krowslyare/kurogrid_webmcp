import "server-only";

type AppointmentUpdate = {
  requestId: string;
  accessToken: string;
  siteSlug: string;
  customerEmail: string;
  petName: string;
  service: string;
  startsAt: string;
  status: "confirmed" | "time_proposed";
};

export type AppointmentDelivery = {
  mode: "demo" | "resend";
  status: "preview" | "sent" | "failed";
  manageUrl: string;
};

function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

export async function sendAppointmentUpdate(
  update: AppointmentUpdate,
): Promise<AppointmentDelivery> {
  const search = new URLSearchParams({
    appointment: update.requestId,
    access: update.accessToken,
  });
  const manageUrl = `${appBaseUrl()}/sites/${update.siteSlug}?${search}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const demoRecipient = process.env.DEMO_NOTIFICATION_EMAIL?.trim();
  const recipient = update.customerEmail.endsWith(".test") && demoRecipient
    ? demoRecipient
    : update.customerEmail;

  if (update.customerEmail.endsWith(".test") && !demoRecipient) {
    return { mode: "demo", status: "preview", manageUrl };
  }

  if (!apiKey || !from) {
    return { mode: "demo", status: "preview", manageUrl };
  }

  const formattedTime = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(update.startsAt));
  const proposed = update.status === "time_proposed";
  const subject = proposed
    ? `Mimo proposed a new time for ${update.petName}`
    : `${update.petName}'s appointment is confirmed`;
  const heading = proposed ? "A new time was proposed." : "The appointment is confirmed.";
  const action = proposed ? "Review the new time" : "View appointment";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `appointment/${update.requestId}/${update.status}/${update.startsAt}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html: `
          <div style="background:#f4f3ed;padding:40px 16px;font-family:Arial,sans-serif;color:#121510">
            <div style="max-width:560px;margin:auto;background:white;border:1px solid #d8dbd0;border-radius:18px;padding:32px">
              <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#355d50">Clínica Mimo</p>
              <h1 style="font-size:32px;line-height:1.1;margin:18px 0">${heading}</h1>
              <p style="font-size:16px;line-height:1.6">${escapeHtml(update.service)} for <strong>${escapeHtml(update.petName)}</strong><br>${escapeHtml(formattedTime)}</p>
              <a href="${escapeHtml(manageUrl)}" style="display:inline-block;margin-top:18px;background:#14271f;color:white;text-decoration:none;padding:14px 20px;border-radius:999px">${action}</a>
              ${proposed ? '<p style="margin-top:22px;font-size:14px;line-height:1.5;color:#58645d">Open this private page with your AI agent to compare the proposed time with your calendar and answer Mimo.</p>' : ""}
              <p style="margin-top:28px;font-size:12px;line-height:1.5;color:#6e746c">This fictional appointment was created as part of the Kuro Agent WebMCP demo.</p>
            </div>
          </div>`,
      }),
    });

    return {
      mode: "resend",
      status: response.ok ? "sent" : "failed",
      manageUrl,
    };
  } catch {
    return { mode: "resend", status: "failed", manageUrl };
  }
}
