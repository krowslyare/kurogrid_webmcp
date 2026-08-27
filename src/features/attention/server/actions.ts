"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export async function createActionPlan(formData: FormData) {
  const organizationSlug = requiredString(formData, "organizationSlug");
  const attentionItemId = requiredString(formData, "attentionItemId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_action_plan", {
    p_attention_item_id: attentionItemId,
    p_idempotency_key: randomUUID(),
  });

  if (error) {
    throw new Error("Unable to create the action plan.", { cause: error });
  }

  revalidatePath(`/app/${organizationSlug}`);
}

export async function acknowledgeLeadAttention(formData: FormData) {
  const organizationSlug = requiredString(formData, "organizationSlug");
  const attentionItemId = requiredString(formData, "attentionItemId");
  const expectedRevision = Number(requiredString(formData, "expectedRevision"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_lead_attention", {
    p_attention_item_id: attentionItemId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw new Error("Unable to acknowledge the attention item.", {
      cause: error,
    });
  }

  revalidatePath(`/app/${organizationSlug}`);
}
