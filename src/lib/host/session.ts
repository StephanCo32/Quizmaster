import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getHost() {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        return null;
    }

    return data.user;
}

export async function getContentAdmin() {
    const host = await getHost();
    if (!host) return null;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("content_admin_check", { p_user_id: host.id });
    if (error) throw new Error("content_admin_check_failed", { cause: error });
    return data ? host : null;
}