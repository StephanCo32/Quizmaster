import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contentAdminEmails } from "@/lib/env";
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
    if (!host || !host.email || !contentAdminEmails().includes(host.email.toLowerCase())) {
        return null;
    }

    const admin = createSupabaseAdminClient();
    await admin.rpc("ensure_content_admin", { p_user_id: host.id });
    return host;
}