import type { Metadata } from "next";
import { HostDashboard } from "@/components/host/host-dashboard";
import { HostSignIn } from "@/components/host/host-sign-in";
import { listHostParties } from "@/lib/host/parties";
import { getHost } from "@/lib/host/session";

export const metadata: Metadata = { title: "Host" };

export default async function HostPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string; authError?: string }>;
}) {
    const host = await getHost();
    const query = await searchParams;

    if (!host) {
        return <HostSignIn nextPath={query.next} callbackFailed={query.authError === "callback"} />;
    }

    const parties = await listHostParties(host.id);
    return <HostDashboard hostEmail={host.email ?? "Authenticated Host"} parties={parties} />;
}