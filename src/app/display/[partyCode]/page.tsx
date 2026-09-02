import { notFound, redirect } from "next/navigation";
import { DisplayOverview } from "@/components/display/display-overview";
import { getDisplayParty, getDisplayPartyCanonicalCode, getDisplayPartyLobby, getDisplayPictureCaptionCandidates, getDisplayPictureCaptionCompletion, getDisplayPictureCaptionResults, getDisplayPictureCaptionRevealCandidates, getDisplayPictureCaptionRound, getDisplaySessionId } from "@/lib/display/sessions";

export default async function DisplayPartyPage({ params }: { params: Promise<{ partyCode: string }> }) {
    const { partyCode } = await params;
    const displaySessionId = await getDisplaySessionId();
    if (!displaySessionId) notFound();
    const canonicalCode = await getDisplayPartyCanonicalCode(displaySessionId, partyCode);
    if (!canonicalCode) notFound();
    if (canonicalCode !== partyCode.toUpperCase()) redirect(`/display/${canonicalCode}`);
    const party = await getDisplayParty(displaySessionId, canonicalCode);
    if (!party) notFound();
    const [roster, activeRound, completion, candidates, revealCandidates, results] = await Promise.all([getDisplayPartyLobby(displaySessionId, canonicalCode), getDisplayPictureCaptionRound(displaySessionId, canonicalCode), getDisplayPictureCaptionCompletion(displaySessionId, canonicalCode), getDisplayPictureCaptionCandidates(displaySessionId, canonicalCode), getDisplayPictureCaptionRevealCandidates(displaySessionId, canonicalCode), getDisplayPictureCaptionResults(displaySessionId, canonicalCode)]);
    return <DisplayOverview initialParty={party} initialRoster={roster} initialActiveRound={activeRound} initialCompletion={completion} initialCandidates={candidates} initialRevealCandidates={revealCandidates} initialResults={results} />;
}