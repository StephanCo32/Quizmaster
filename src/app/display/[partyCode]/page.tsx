import { notFound } from "next/navigation";
import { DisplayOverview } from "@/components/display/display-overview";
import { getDisplayParty, getDisplayPartyLobby, getDisplaySessionId } from "@/lib/display/sessions";

export default async function DisplayPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const displaySessionId = await getDisplaySessionId();
    if (!displaySessionId) notFound();
    const party = await getDisplayParty(displaySessionId, partyCode);
    if (!party) notFound();
    return <DisplayOverview initialParty={party} initialRoster={await getDisplayPartyLobby(displaySessionId, partyCode)} />;
}