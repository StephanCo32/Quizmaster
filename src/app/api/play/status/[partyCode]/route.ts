import { NextResponse } from "next/server";
import { getPartyLobbyStatus } from "@/lib/player/parties";

export async function GET(_request: Request, context: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await context.params;
    try {
        const status = await getPartyLobbyStatus(partyCode);
        return status ? NextResponse.json({ status }) : NextResponse.json({ error: "not_found" }, { status: 404 });
    } catch {
        return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
}
