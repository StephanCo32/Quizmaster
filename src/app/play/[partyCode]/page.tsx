import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlayerLobby } from "@/components/player/player-lobby";
import { getPlayerId } from "@/lib/player/identity";
import { getPlayerPartyCanonicalCode, getPlayerPartyLobby, getPlayerPictureCaptionRound, getPlayerPictureCaptionSubmission } from "@/lib/player/parties";

export const metadata: Metadata = { title: "Player Lobby" };

export default async function PlayerPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const playerId = await getPlayerId();
    if (!playerId) notFound();
    const canonicalCode = await getPlayerPartyCanonicalCode(playerId, partyCode);
    if (!canonicalCode) notFound();
    if (canonicalCode !== partyCode.toUpperCase()) redirect(`/play/${canonicalCode}`);
    const roster = await getPlayerPartyLobby(playerId, canonicalCode);
    if (roster.length === 0) notFound();
    const [activeRound, submission] = await Promise.all([getPlayerPictureCaptionRound(playerId, canonicalCode), getPlayerPictureCaptionSubmission(playerId, canonicalCode)]);
    return <PlayerLobby partyCode={canonicalCode} initialRoster={roster} initialActiveRound={activeRound} initialSubmission={submission} />;
}
