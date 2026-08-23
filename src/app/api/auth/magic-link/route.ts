import { z } from "zod";
import { hostReturnPath } from "@/lib/host/return-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
    email: z.email(),
    next: z.string().optional(),
});

export async function POST(request: Request) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
        return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const callbackUrl = new URL("/auth/callback", request.url);
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