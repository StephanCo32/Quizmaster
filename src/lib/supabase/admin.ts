import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseEnvironment } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseAdminClient() {
    const environment = parseEnvironment(process.env);

    return createClient<Database>(
        environment.NEXT_PUBLIC_SUPABASE_URL,
        environment.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                detectSessionInUrl: false,
                persistSession: false,
            },
        },
    );
}