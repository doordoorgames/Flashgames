import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_ANON_KEY"];

export function getSupabase() {
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for the Flash content database.");
  }
  return createClient(url, key);
}
