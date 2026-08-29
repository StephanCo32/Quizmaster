import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { joinParty } from "@/lib/player/parties";
import { playerCookieName } from "@/lib/player/identity";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const schema = z.object({ commandId: z.string().uuid(), partyCode: z.string().regex(/^[A-Za-z0-9]{6}$/), nickname: z.string().trim().min(1).max(30), expectedRevision: z.number().int().nonnegative() });

export async function POST(request: Request) {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const cookieStore = await cookies();
    let playerId = cookieStore.get(playerCookieName)?.value;
    if (!playerId) playerId = crypto.randomUUID();
    try {
        const member = await joinParty({ playerId, ...parsed.data });
        await publishLobbyInvalidation({ gameSessionId: member.game_session_id, revision: member.session_revision });
        const response = NextResponse.json({ member });
        if (!cookieStore.has(playerCookieName)) response.cookies.set(playerCookieName, playerId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "join_failed";
        const status = message === "nickname_taken" || message === "stale_revision" ? 409 : ["joining_closed", "party_not_found", "player_removed"].includes(message) ? 404 : 503;
        return NextResponse.json({ error: message === "nickname_taken" || message === "stale_revision" ? message : status === 404 ? "not_found" : "unavailable" }, { status });
    }
}
