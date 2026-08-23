import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerLobby } from "@/components/player/player-lobby";
import { getPlayerId } from "@/lib/player/identity";
import { getPlayerPartyLobby } from "@/lib/player/parties";

export const metadata: Metadata = { title: "Player Lobby" };

export default async function PlayerPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const playerId = await getPlayerId();
    if (!playerId) notFound();
    const roster = await getPlayerPartyLobby(playerId, partyCode);
    if (roster.length === 0) notFound();
    return <PlayerLobby partyCode={partyCode.toUpperCase()} initialRoster={roster} />;
}
