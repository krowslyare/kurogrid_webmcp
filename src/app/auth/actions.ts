"use server";

import { redirect } from "next/navigation";

import { releaseCurrentDemoLease } from "@/features/demo/server/lease";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "/app";
  }

  return value === "/app" || value.startsWith("/app/") ? value : "/app";
}

export async function signIn(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const nextPath = safeNextPath(formData.get("next"));

  if (typeof email !== "string" || typeof password !== "string") {
    redirect(
      `/auth/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    redirect(
      `/auth/sign-in?error=invalid_credentials&next=${encodeURIComponent(nextPath)}`,
    );
  }

  redirect(nextPath);
}

export async function signOut() {
  await releaseCurrentDemoLease();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/");
}
