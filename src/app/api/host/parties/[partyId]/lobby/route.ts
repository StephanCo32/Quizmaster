import { NextResponse } from "next/server";
import { z } from "zod";
import { getHostParty } from "@/lib/host/parties";
import { getHost } from "@/lib/host/session";
import { getHostPartyLobby, openPartyLobby, rotatePartyCode, setPartyJoining, setPartyMemberAccess } from "@/lib/player/parties";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const commandSchema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }).strict();
const patchSchema = z.discriminatedUnion("action", [
    commandSchema.extend({ action: z.literal("set-joining"), joiningOpen: z.boolean() }).strict(),
    commandSchema.extend({ action: z.literal("set-member-access"), memberId: z.string().uuid(), accessStatus: z.enum(["joined", "removed"]) }).strict(),
    commandSchema.extend({ action: z.literal("rotate-code") }).strict(),
]);

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
    const parsed = commandSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyId } = await context.params;
    try {
        const opened = await openPartyLobby({ hostId: host.id, partyId, ...parsed.data });
        await publishLobbyInvalidation({ gameSessionId: opened.game_session_id, revision: opened.session_revision });
        return NextResponse.json({ opened: true });
    }
    catch (error) { const stale = error instanceof Error && error.message === "stale_revision"; return NextResponse.json({ error: stale ? "stale_revision" : "unavailable" }, { status: stale ? 409 : 503 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const command = patchSchema.safeParse(await request.json());
    if (!command.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyId } = await context.params;
    try {
        if (command.data.action === "rotate-code") {
            const result = await rotatePartyCode({ hostId: host.id, partyId, ...command.data });
            await publishLobbyInvalidation({ gameSessionId: result.game_session_id, revision: result.session_revision });
            return NextResponse.json({ partyCode: result.party_code });
        }
        const result = command.data.action === "set-joining"
            ? await setPartyJoining({ hostId: host.id, partyId, ...command.data })
            : await setPartyMemberAccess({ hostId: host.id, partyId, ...command.data });
        await publishLobbyInvalidation({ gameSessionId: result.game_session_id, revision: result.session_revision });
        return NextResponse.json({ updated: true });
    } catch (error) { const stale = error instanceof Error && error.message === "stale_revision"; return NextResponse.json({ error: stale ? "stale_revision" : "unavailable" }, { status: stale ? 409 : 503 }); }
}
