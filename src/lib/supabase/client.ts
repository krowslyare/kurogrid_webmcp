import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
