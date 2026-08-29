import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerId } from "@/lib/player/identity";
import { submitPictureCaption } from "@/lib/player/parties";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const schema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), caption: z.string().max(1000) }).strict();
export async function POST(request: Request, context: { params: Promise<{ partyCode: string }> }) {
    const playerId = await getPlayerId(); if (!playerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyCode } = await context.params;
    try { const result = await submitPictureCaption({ playerId, partyCode, ...parsed.data }); await publishLobbyInvalidation({ gameSessionId: result.game_session_id, revision: result.session_revision }); return NextResponse.json({ submitted: true }); }
    catch (error) { const message = error instanceof Error ? error.message : "unavailable"; return NextResponse.json({ error: message === "invalid_caption" ? message : message === "stale_revision" ? message : "unavailable" }, { status: message === "invalid_caption" ? 400 : message === "stale_revision" ? 409 : 503 }); }
}