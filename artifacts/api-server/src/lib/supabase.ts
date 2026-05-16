import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_ANON_KEY"];

if (!url || !key) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required but not set.",
  );
}

export const supabase = createClient(url, key);
