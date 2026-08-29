import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { displaySessionCookieName, revokeDisplaySession } from "@/lib/display/sessions";
import { getHost } from "@/lib/host/session";

const partyIdSchema = z.string().uuid();

export async function DELETE(_request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    const { partyId } = await context.params;
    if (!host || !partyIdSchema.safeParse(partyId).success) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
        await revokeDisplaySession(host.id, partyId);
        (await cookies()).delete(displaySessionCookieName);
        return NextResponse.json({ revoked: true });
    } catch {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
}