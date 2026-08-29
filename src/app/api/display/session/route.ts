import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDisplaySession, displaySessionCookieName } from "@/lib/display/sessions";
import { getHost } from "@/lib/host/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ partyId: z.string().uuid(), commandId: z.string().uuid() }).strict();

export async function POST(request: Request) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const command = schema.safeParse(await request.json());
    if (!command.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const displaySessionId = crypto.randomUUID();
    try {
        const display = await authorizeDisplaySession({ hostId: host.id, displaySessionId, ...command.data });
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
        const response = NextResponse.json({ partyCode: display.party_code });
        response.cookies.set(displaySessionCookieName, displaySessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        return response;
    } catch {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
}