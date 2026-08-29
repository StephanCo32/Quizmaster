import { NextResponse } from "next/server";
import { getDisplayParty, getDisplayPartyCanonicalCode, getDisplayPartyLobby, getDisplaySessionId } from "@/lib/display/sessions";

export async function GET(_request: Request, context: { params: Promise<{ partyCode: string }> }) {
    const displaySessionId = await getDisplaySessionId();
    const { partyCode } = await context.params;
    if (!displaySessionId || !/^[A-Za-z0-9]{6}$/.test(partyCode)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
        const canonicalCode = await getDisplayPartyCanonicalCode(displaySessionId, partyCode);
        if (!canonicalCode) return NextResponse.json({ error: "not_found" }, { status: 404 });
        const party = await getDisplayParty(displaySessionId, canonicalCode);
        if (!party) return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json({ canonicalCode, party, roster: await getDisplayPartyLobby(displaySessionId, canonicalCode) });
    } catch {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
}