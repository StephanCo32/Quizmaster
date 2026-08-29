import { NextResponse } from "next/server";
import { getPlayerId } from "@/lib/player/identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ partyCode: string; roundId: string }> }) {
    const playerId = await getPlayerId();
    const { partyCode, roundId } = await context.params;
    if (!playerId) return new NextResponse(null, { status: 404 });
    const { data: source } = await createSupabaseAdminClient().rpc("player_picture_caption_round_picture", { p_player_id: playerId, p_party_code: partyCode, p_round_id: roundId });
    if (!source) return new NextResponse(null, { status: 404 });
    try { const response = await fetch(source, { redirect: "follow" }); return response.ok && response.headers.get("content-type")?.startsWith("image/") ? new NextResponse(response.body, { headers: { "Content-Type": response.headers.get("content-type") ?? "image/*" } }) : new NextResponse(null, { status: 404 }); } catch { return new NextResponse(null, { status: 404 }); }
}