import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PartySetup } from "@/components/host/party-setup";
import { getHostParty } from "@/lib/host/parties";
import { getHostPictureCaptionBallots, getHostPictureCaptionCompletion, getHostPictureCaptionRounds, getHostPictureCaptionSubmissions, getHostPictureCaptionTemplates } from "@/lib/host/rounds";
import { getHostPartyLobby } from "@/lib/player/parties";
import { getHost } from "@/lib/host/session";

export const metadata: Metadata = { title: "Party control" };

export default async function HostPartyPage({
    params,
}: {
    params: Promise<{ partyId: string }>;
}) {
    const { partyId } = await params;
    const host = await getHost();

    if (!host) {
        redirect(`/host?next=${encodeURIComponent(`/host/parties/${partyId}`)}`);
    }

    const party = await getHostParty(host.id, partyId);
    if (!party) {
        notFound();
    }

    const [roster, rounds, templates, submissions, completion, ballots] = await Promise.all([getHostPartyLobby(host.id, partyId), getHostPictureCaptionRounds(host.id, partyId), getHostPictureCaptionTemplates(host.id, partyId), getHostPictureCaptionSubmissions(host.id, partyId), getHostPictureCaptionCompletion(host.id, partyId), getHostPictureCaptionBallots(host.id, partyId)]);
    return <PartySetup party={party} roster={roster} rounds={rounds} templates={templates} initialSubmissions={submissions} initialCompletion={completion} initialBallots={ballots} />;
}