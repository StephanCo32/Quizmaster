import { NextResponse } from "next/server";
import { z } from "zod";
import { getHostParty } from "@/lib/host/parties";
import { getHost } from "@/lib/host/session";
import { getHostPartyLobby, openPartyLobby } from "@/lib/player/parties";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const schema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() });

export async function GET(_request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { partyId } = await context.params;
    const [party, roster] = await Promise.all([getHostParty(host.id, partyId), getHostPartyLobby(host.id, partyId)]);
    return party ? NextResponse.json({ party, roster }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyId } = await context.params;
    try {
        const opened = await openPartyLobby({ hostId: host.id, partyId, ...parsed.data });
        await publishLobbyInvalidation({ gameSessionId: opened.game_session_id, revision: opened.session_revision });
        return NextResponse.json({ opened: true });
    }
    catch (error) { const stale = error instanceof Error && error.message === "stale_revision"; return NextResponse.json({ error: stale ? "stale_revision" : "unavailable" }, { status: stale ? 409 : 503 }); }
}
