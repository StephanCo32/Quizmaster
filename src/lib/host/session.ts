import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/host/admin-session";

type Host = {
    id: string;
    email: string | undefined;
};

export async function getHost(): Promise<Host | null> {
    const adminSession = await getAdminSession();
    if (adminSession) {
        return { id: adminSession.userId, email: adminSession.email };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        return null;
    }

    return { id: data.user.id, email: data.user.email };
}

export async function getContentAdmin() {
    const host = await getHost();
    if (!host) return null;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("content_admin_check", { p_user_id: host.id });
    if (error) throw new Error("content_admin_check_failed", { cause: error });
    return data ? host : null;
}