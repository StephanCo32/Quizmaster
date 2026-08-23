import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PartySetup } from "@/components/host/party-setup";
import { getHostParty } from "@/lib/host/parties";
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

    return <PartySetup party={party} />;
}