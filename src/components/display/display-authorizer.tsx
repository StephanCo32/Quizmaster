"use client";

import { MonitorUp, Radio, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PartyProjection } from "@/lib/supabase/database.types";

export function DisplayAuthorizer({ parties }: { parties: PartyProjection[] }) {
    const [busyPartyId, setBusyPartyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function authorize(partyId: string) {
        setBusyPartyId(partyId);
        setError(null);
        const response = await fetch("/api/display/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ partyId, commandId: crypto.randomUUID() }),
        });
        if (!response.ok) {
            setError("The display could not be authorized.");
            setBusyPartyId(null);
            return;
        }
        const { partyCode } = await response.json() as { partyCode: string };
        window.location.assign(`/display/${partyCode}`);
    }

    async function revoke(partyId: string) {
        setBusyPartyId(partyId);
        setError(null);
        const response = await fetch(`/api/display/session/${partyId}`, { method: "DELETE" });
        if (!response.ok) setError("The display session could not be revoked.");
        setBusyPartyId(null);
    }

    return <main className="broadcast-shell"><header className="broadcast-header"><Link className="broadcast-brand" href="/host"><span className="broadcast-mark">Q</span><span>Quizmaster</span></Link><span className="signal-chip"><Radio size={16} /> Display channel</span></header><div className="dashboard-grid"><section className="dashboard-stage"><p className="broadcast-kicker">Shared screen</p><h1>Authorize display</h1><p>Select an owned Party. This browser becomes its read-only shared screen and signs out of Host control.</p>{error && <div className="status-notice status-error" role="alert">{error}</div>}<div className="party-list">{parties.map((party) => <div className="party-row" key={party.party_id}><span className="party-index">{party.party_code}</span><div><strong>Party {party.party_code}</strong><span>{party.game_session_state} · {party.display_active ? "Display active" : "No display"}</span></div>{party.display_active ? <button className="icon-button" type="button" disabled={busyPartyId === party.party_id} onClick={() => void revoke(party.party_id)} title={`Revoke display for ${party.party_code}`} aria-label={`Revoke display for ${party.party_code}`}><X aria-hidden="true" /></button> : <button className="icon-button" type="button" disabled={busyPartyId === party.party_id} onClick={() => void authorize(party.party_id)} title={`Authorize display for ${party.party_code}`} aria-label={`Authorize display for ${party.party_code}`}><MonitorUp aria-hidden="true" /></button>}</div>)}</div></section></div></main>;
}