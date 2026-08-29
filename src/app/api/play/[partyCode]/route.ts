import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlayerId } from "@/lib/player/identity";
import { changeNickname, getPlayerPartyCanonicalCode, getPlayerPartyLobby, getPlayerPictureCaptionCandidates, getPlayerPictureCaptionRound, getPlayerPictureCaptionSubmission, setReady } from "@/lib/player/parties";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const commandSchema = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() });
const nicknameSchema = commandSchema.extend({ nickname: z.string().trim().min(1).max(30) });
const readySchema = commandSchema.extend({ ready: z.boolean() });

export async function GET(_request: Request, context: { params: Promise<{ partyCode: string }> }) {
    const playerId = await getPlayerId();
    const { partyCode } = await context.params;
    if (!playerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
        const canonicalCode = await getPlayerPartyCanonicalCode(playerId, partyCode);
        if (!canonicalCode) return NextResponse.json({ error: "not_found" }, { status: 404 });
        const [roster, activeRound, submission, candidates] = await Promise.all([getPlayerPartyLobby(playerId, canonicalCode), getPlayerPictureCaptionRound(playerId, canonicalCode), getPlayerPictureCaptionSubmission(playerId, canonicalCode), getPlayerPictureCaptionCandidates(playerId, canonicalCode)]);
        return NextResponse.json({ canonicalCode, roster, activeRound, submission, candidates });
    }
    catch { return NextResponse.json({ error: "not_found" }, { status: 404 }); }
}

export async function PATCH(request: Request, _context: { params: Promise<{ partyCode: string }> }) {
    const playerId = await getPlayerId();
    if (!playerId) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const body = await request.json();
    const { partyCode } = await _context.params;
    if (!/^[A-Za-z0-9]{6}$/.test(partyCode)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const nickname = nicknameSchema.safeParse(body);
    const ready = readySchema.safeParse(body);
    try {
        const member = nickname.success
            ? await changeNickname({ playerId, memberId: body.memberId, commandId: nickname.data.commandId, nickname: nickname.data.nickname, expectedRevision: nickname.data.expectedRevision })
            : ready.success
                ? await setReady({ playerId, memberId: body.memberId, commandId: ready.data.commandId, ready: ready.data.ready, expectedRevision: ready.data.expectedRevision })
                : null;
        if (member) {
            await publishLobbyInvalidation({ gameSessionId: member.game_session_id, revision: member.session_revision });
            return NextResponse.json({ member });
        }
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "unavailable";
        return NextResponse.json({ error: message === "nickname_taken" ? message : message === "stale_revision" ? message : "unavailable" }, { status: message === "nickname_taken" || message === "stale_revision" ? 409 : 503 });
    }
}