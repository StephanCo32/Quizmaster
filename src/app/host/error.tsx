"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function HostError({ reset }: { reset: () => void }) {
    return (
        <main className="broadcast-shell state-screen">
            <div className="state-block error-block">
                <TriangleAlert aria-hidden="true" />
                <span className="broadcast-kicker">Signal interrupted</span>
                <h1>Control room unavailable.</h1>
                <p>Your last committed Party state is safe. Reconnect and request the current projection.</p>
                <button className="broadcast-action" type="button" onClick={reset}><RefreshCw /> Reconnect</button>
            </div>
        </main>
    );
}