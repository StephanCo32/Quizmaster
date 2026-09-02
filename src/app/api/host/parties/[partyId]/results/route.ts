import { NextResponse } from "next/server";
import { z } from "zod";
import { continuePictureCaptionRound, getHostPictureCaptionRevealCandidates, revealPictureCaptionCandidate, startPictureCaptionReveal } from "@/lib/host/rounds";
import { getHost } from "@/lib/host/session";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";
const schema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("start-reveal"), commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }).strict(),
    z.object({ action: z.literal("continue"), commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }).strict(),
    z.object({ action: z.literal("reveal"), commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), candidateId: z.string().uuid() }).strict(),
]);
export async function GET(_request: Request, context: { params: Promise<{ partyId: string }> }) { const host = await getHost(); if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 }); try { return NextResponse.json({ candidates: await getHostPictureCaptionRevealCandidates(host.id, (await context.params).partyId) }); } catch { return NextResponse.json({ error: "not_found" }, { status: 404 }); } }
export async function POST(request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost(); const parsed = schema.safeParse(await request.json()); if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 }); if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    try {
        const { partyId } = await context.params;
        const base = { hostId: host.id, partyId, commandId: parsed.data.commandId, expectedRevision: parsed.data.expectedRevision };
        const result = parsed.data.action === "start-reveal" ? await startPictureCaptionReveal(base)
            : parsed.data.action === "reveal" ? await revealPictureCaptionCandidate({ ...base, candidateId: parsed.data.candidateId })
            : await continuePictureCaptionRound(base);
        await publishLobbyInvalidation({ gameSessionId: result.game_session_id, revision: result.session_revision });
        return NextResponse.json({ completed: true });
    } catch (error) { const message = error instanceof Error ? error.message : "unavailable"; return NextResponse.json({ error: message }, { status: message === "reveal_incomplete" ? 409 : message === "candidate_not_found" ? 404 : 409 }); }
}