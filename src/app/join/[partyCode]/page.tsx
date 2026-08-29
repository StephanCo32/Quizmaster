import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayerJoin } from "@/components/player/player-join";
import { getPlayerId } from "@/lib/player/identity";
import { getPartyLobbyStatus, getPlayerPartyCanonicalCode } from "@/lib/player/parties";

export const metadata: Metadata = { title: "Join Party" };

export default async function JoinPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const playerId = await getPlayerId();
    if (playerId) {
        const canonicalCode = await getPlayerPartyCanonicalCode(playerId, partyCode);
        if (canonicalCode && canonicalCode !== partyCode.toUpperCase()) redirect(`/play/${canonicalCode}`);
    }
    const status = await getPartyLobbyStatus(partyCode);
    if (!status) notFound();
    return <PlayerJoin initialCode={status.party_code} />;
}
