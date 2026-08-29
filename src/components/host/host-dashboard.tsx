"use client";

import { CirclePlus, LogOut, Radio, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PartyProjection } from "@/lib/supabase/database.types";

type HostDashboardProps = {
    hostEmail: string;
    parties: PartyProjection[];
    isContentAdmin?: boolean;
    connectionState?: "connected" | "disconnected";
    initialCreateStatus?: "idle" | "creating" | "error";
};

export function HostDashboard({
    hostEmail,
    parties,
    isContentAdmin = false,
    connectionState = "connected",
    initialCreateStatus = "idle",
}: HostDashboardProps) {
    const router = useRouter();
    const [createStatus, setCreateStatus] = useState<"idle" | "creating" | "error">(initialCreateStatus);

    async function createParty() {
        setCreateStatus("creating");
        const response = await fetch("/api/host/parties", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                commandId: crypto.randomUUID(),
                expectedRevision: 0,
            }),
        });

        if (!response.ok) {
            setCreateStatus("error");
            return;
        }

        const party = (await response.json()) as { party_id: string };
        router.push(`/host/parties/${party.party_id}`);
    }

    return (
        <main className="broadcast-shell">
            <header className="broadcast-header">
                <Link className="broadcast-brand" href="/host">
                    <span className="broadcast-mark">Q</span>
                    <span>Quizmaster</span>
                </Link>
                <div className="host-identity">
                    <span className="signal-chip"><Radio size={16} /> Host online</span>
                    <span>{hostEmail}</span>
                    <form action="/api/auth/sign-out" method="post">
                        <button className="icon-button" type="submit" title="Sign out" aria-label="Sign out">
                            <LogOut aria-hidden="true" />
                        </button>
                    </form>
                </div>
            </header>
            <div className="dashboard-grid">
                <section className="dashboard-stage">
                    <p className="broadcast-kicker">Your control rooms</p>
                    <div className="dashboard-title-row">
                        <div>
                            <h1>Parties</h1>
                            <p>Choose a room or bring a new one online.</p>
                        </div>
                        <button className="broadcast-action" type="button" onClick={createParty} disabled={createStatus === "creating" || connectionState === "disconnected"}>
                            <CirclePlus aria-hidden="true" />
                            {createStatus === "creating" ? "Creating..." : "Create Party"}
                        </button>
                    </div>
                    {createStatus === "error" && (
                        <div className="status-notice status-error" role="alert">
                            Party creation failed. No changes were committed; try again.
                        </div>
                    )}
                    {parties.length === 0 ? (
                        <div className="empty-broadcast">
                            <span>00</span>
                            <h2>No Parties on air</h2>
                            <p>Create the first Party to enter Setup.</p>
                        </div>
                    ) : (
                        <div className="party-list">
                            {parties.map((party, index) => (
                                <Link className="party-row" href={`/host/parties/${party.party_id}`} key={party.party_id}>
                                    <span className="party-index">{String(index + 1).padStart(2, "0")}</span>
                                    <div>
                                        <strong>Party {party.party_code}</strong>
                                        <span>{party.game_session_state} · Revision {party.revision}</span>
                                    </div>
                                    <Settings2 aria-hidden="true" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
                <aside className="dashboard-rail">
                    <span className="rail-label">System monitor</span>
                    {connectionState === "disconnected" && (
                        <div className="status-notice status-error" role="alert">
                            Disconnected. Writes are paused while the last committed projection remains visible.
                        </div>
                    )}
                    <dl className="monitor-list">
                        <div><dt>Owned Parties</dt><dd>{parties.length}</dd></div>
                        <div><dt>Data authority</dt><dd>Server</dd></div>
                        <div><dt>Region</dt><dd>FRA1</dd></div>
                    </dl>
                    {isContentAdmin && <Link className="rail-link" href="/host/templates">Picture-caption templates</Link>}
                    <div className={`connection-card connection-${connectionState}`}>
                        <span className="connection-light" aria-hidden="true" />
                        <div>
                            <strong>{connectionState === "connected" ? "Connected" : "Disconnected"}</strong>
                            <span>{connectionState === "connected" ? "Host projection current" : "Showing last committed state"}</span>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}