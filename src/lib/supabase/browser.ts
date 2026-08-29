"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseBrowserClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) throw new Error("Supabase browser configuration is unavailable");

    return createClient<Database>(url, key, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
}