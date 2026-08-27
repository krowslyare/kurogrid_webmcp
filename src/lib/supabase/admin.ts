import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getAdminSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url, secretKey } = getAdminSupabaseConfig();

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
