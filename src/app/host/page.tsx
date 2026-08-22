import type { Metadata } from "next";

import { RoleShell } from "@/components/role-shell";

export const metadata: Metadata = { title: "Host" };

export default function HostPage() {
    return (
        <RoleShell
            code="HOST / 01"
            eyebrow="Control the room"
            title="Host dashboard"
            description="Create a session, configure rounds, and keep the game moving."
            status="Ready for setup"
        />
    );
}