import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hostReturnPath } from "@/lib/host/return-path";
import { appUrl, contentAdminSecret } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
    email: z.email(),
    next: z.string().optional(),
    admin: z.boolean().optional(),
    secret: z.string().optional(),
});

function secretsMatch(candidate: string | undefined, configured: string | null) {
    if (!candidate || !configured) return false;
    const candidateBytes = Buffer.from(candidate);
    const configuredBytes = Buffer.from(configured);
    return candidateBytes.length === configuredBytes.length && timingSafeEqual(candidateBytes, configuredBytes);
}

export async function POST(request: Request) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
        return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    if (parsed.data.admin) {
        if (!secretsMatch(parsed.data.secret, contentAdminSecret())) {
            return Response.json({ error: "invalid_admin_credentials" }, { status: 403 });
        }
        const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = data?.users.find((candidate) => candidate.email?.toLowerCase() === parsed.data.email.toLowerCase());
        if (error || !user) return Response.json({ error: "invalid_admin_credentials" }, { status: 403 });
        const { data: isAdmin, error: roleError } = await admin.rpc("content_admin_check", { p_user_id: user.id });
        if (roleError || !isAdmin) return Response.json({ error: "invalid_admin_credentials" }, { status: 403 });
    }

    const callbackUrl = new URL("/auth/callback", appUrl() ?? request.url);
    callbackUrl.searchParams.set("next", hostReturnPath(parsed.data.next));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (error) {
        return Response.json({ error: "magic_link_unavailable" }, { status: 503 });
    }

    return Response.json({ status: "sent" }, { status: 202 });
}