import { NextResponse } from "next/server";
import { z } from "zod";
import { getHost } from "@/lib/host/session";
import { openPartyLobby } from "@/lib/player/parties";

const schema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() });

export async function POST(request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyId } = await context.params;
    try { return NextResponse.json({ opened: await openPartyLobby({ hostId: host.id, partyId, ...parsed.data }) }); }
    catch (error) { const stale = error instanceof Error && error.message === "stale_revision"; return NextResponse.json({ error: stale ? "stale_revision" : "unavailable" }, { status: stale ? 409 : 503 }); }
}
