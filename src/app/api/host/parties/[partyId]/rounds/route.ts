import { NextResponse } from "next/server";
import { z } from "zod";
import { getHost } from "@/lib/host/session";
import { getHostPictureCaptionRounds, getHostPictureCaptionTemplates, mutatePictureCaptionRound } from "@/lib/host/rounds";
import { publishLobbyInvalidation } from "@/lib/realtime/lobby-invalidation";

const command = z.object({ commandId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }).strict();
const mutation = z.discriminatedUnion("action", [
    command.extend({ action: z.literal("add"), templateId: z.string().uuid(), captioningSeconds: z.number().int().min(5).max(600).optional(), votingSeconds: z.number().int().min(5).max(600).optional(), captionGraphemeLimit: z.number().int().min(1).max(120).optional() }).strict(),
    command.extend({ action: z.literal("delete"), roundId: z.string().uuid() }).strict(),
    command.extend({ action: z.literal("duplicate"), roundId: z.string().uuid() }).strict(),
    command.extend({ action: z.literal("edit"), roundId: z.string().uuid(), templateId: z.string().uuid().optional(), captioningSeconds: z.number().int().min(5).max(600).optional(), votingSeconds: z.number().int().min(5).max(600).optional(), captionGraphemeLimit: z.number().int().min(1).max(120).optional() }).strict(),
    command.extend({ action: z.literal("reorder"), roundId: z.string().uuid(), position: z.number().int().nonnegative() }).strict(),
]);

export async function GET(_request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { partyId } = await context.params;
    try { return NextResponse.json({ rounds: await getHostPictureCaptionRounds(host.id, partyId), templates: await getHostPictureCaptionTemplates(host.id, partyId) }); }
    catch { return NextResponse.json({ error: "not_found" }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ partyId: string }> }) {
    const host = await getHost();
    if (!host) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = mutation.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const { partyId } = await context.params;
    try {
        const command = parsed.data;
        const result = await mutatePictureCaptionRound({
            hostId: host.id, partyId, commandId: command.commandId, expectedRevision: command.expectedRevision, action: command.action,
            ...(command.action === "add" ? { roundId: null, templateId: command.templateId, captioningSeconds: command.captioningSeconds, votingSeconds: command.votingSeconds, captionGraphemeLimit: command.captionGraphemeLimit } : command.action === "reorder" ? { roundId: command.roundId, position: command.position } : command.action === "edit" ? { roundId: command.roundId, templateId: command.templateId, captioningSeconds: command.captioningSeconds, votingSeconds: command.votingSeconds, captionGraphemeLimit: command.captionGraphemeLimit } : { roundId: command.roundId }),
        });
        await publishLobbyInvalidation({ gameSessionId: result.game_session_id, revision: result.session_revision });
        return NextResponse.json({ updated: true });
    } catch (error) { const message = error instanceof Error ? error.message : "unavailable"; const known = ["stale_revision", "official_caption_required"]; return NextResponse.json({ error: known.includes(message) ? message : "unavailable" }, { status: message === "stale_revision" ? 409 : message === "official_caption_required" ? 422 : 503 }); }
}