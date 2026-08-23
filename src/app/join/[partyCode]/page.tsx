import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerJoin } from "@/components/player/player-join";
import { getPartyLobbyStatus } from "@/lib/player/parties";

export const metadata: Metadata = { title: "Join Party" };

export default async function JoinPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const status = await getPartyLobbyStatus(partyCode);
    if (!status) notFound();
    return <PlayerJoin initialCode={status.party_code} />;
}
