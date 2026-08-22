import type { Metadata } from "next";

import { RoleShell } from "@/components/role-shell";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
    return (
        <RoleShell
            code="PLAYER / 02"
            eyebrow="Your move"
            title="Player view"
            description="Join from your phone and respond when the room turns to you."
            status="Waiting for a lobby"
        />
    );
}