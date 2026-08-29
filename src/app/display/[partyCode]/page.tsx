import { notFound, redirect } from "next/navigation";
import { DisplayOverview } from "@/components/display/display-overview";
import { getDisplayParty, getDisplayPartyCanonicalCode, getDisplayPartyLobby, getDisplaySessionId } from "@/lib/display/sessions";

export default async function DisplayPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const displaySessionId = await getDisplaySessionId();
    if (!displaySessionId) notFound();
    const canonicalCode = await getDisplayPartyCanonicalCode(displaySessionId, partyCode);
    if (!canonicalCode) notFound();
    if (canonicalCode !== partyCode.toUpperCase()) redirect(`/display/${canonicalCode}`);
    const party = await getDisplayParty(displaySessionId, canonicalCode);
    if (!party) notFound();
    return <DisplayOverview initialParty={party} initialRoster={await getDisplayPartyLobby(displaySessionId, canonicalCode)} />;
}