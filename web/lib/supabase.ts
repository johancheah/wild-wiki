import { createClient } from "@supabase/supabase-js";

// Anon key only — read-only, safe to expose. Row Level Security on the
// underlying tables (see db/README-supabase-setup.md) is what actually
// enforces "read but not write"; this key alone doesn't guarantee that.
// The service_role key (read/write) is used only by the Python ingestion
// scripts, never here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
