import type { Metadata } from "next";

import { RoleShell } from "@/components/role-shell";

export const metadata: Metadata = { title: "Display" };

export default function DisplayPage() {
    return (
        <RoleShell
            code="DISPLAY / 03"
            eyebrow="The shared stage"
            title="Public display"
            description="Keep every player aligned with the current round and scoreboard."
            status="Waiting for a session"
        />
    );
}