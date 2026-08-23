"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OpenLobbyButton({ partyId, expectedRevision }: { partyId: string; expectedRevision: number }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    async function openLobby() {
        setBusy(true); setError(false);
        const response = await fetch(`/api/host/parties/${partyId}/lobby`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision }) });
        if (!response.ok) { setError(true); setBusy(false); return; }
        router.refresh();
    }

    return <><button className="broadcast-action" type="button" disabled={busy} onClick={() => void openLobby()}>{busy ? "Opening..." : "Open Lobby"}</button>{error && <div className="status-notice status-error" role="alert">The Lobby could not be opened. Refresh and try again.</div>}</>;
}
