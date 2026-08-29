"use client";

import { useState } from "react";

export function OpenLobbyButton({
  partyId,
  expectedRevision,
  disabled = false,
  onOpened,
}: {
  partyId: string;
  expectedRevision: number;
  disabled?: boolean;
  onOpened?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function openLobby() {
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/host/parties/${partyId}/lobby`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commandId: crypto.randomUUID(),
        expectedRevision,
      }),
    });
    if (!response.ok) {
      setError(true);
      setBusy(false);
      return;
    }
    await onOpened?.();
    setBusy(false);
  }

  return (
    <>
      <button
        className="broadcast-action"
        type="button"
        disabled={busy || disabled}
        onClick={() => void openLobby()}
      >
        {busy ? "Opening..." : "Open Lobby"}
      </button>
      {error && (
        <div className="status-notice status-error" role="alert">
          The Lobby could not be opened. Refresh and try again.
        </div>
      )}
    </>
  );
}
