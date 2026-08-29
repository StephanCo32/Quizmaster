import type { Metadata } from "next";
import { DisplayAuthorizer } from "@/components/display/display-authorizer";
import { HostSignIn } from "@/components/host/host-sign-in";
import { listHostParties } from "@/lib/host/parties";
import { getHost } from "@/lib/host/session";

export const metadata: Metadata = { title: "Display" };

export default async function DisplayPage() {
    const host = await getHost();
    if (!host) return <HostSignIn nextPath="/display" />;
    return <DisplayAuthorizer parties={await listHostParties(host.id)} />;
}