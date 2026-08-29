import type { LobbyInvalidation } from "./lobby-events";

function isInvalidation(value: unknown): value is LobbyInvalidation {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<LobbyInvalidation>;
    return typeof candidate.gameSessionId === "string" && typeof candidate.revision === "number" && Number.isSafeInteger(candidate.revision);
}

export function createLobbyInvalidationHandler(options: {
    gameSessionId: string;
    getRevision: () => number;
    refetch: () => Promise<void>;
}) {
    let latestInvalidation = options.getRevision();

    return (payload: unknown) => {
        if (!isInvalidation(payload)) return;
        if (payload.gameSessionId !== options.gameSessionId) return;

        latestInvalidation = Math.max(latestInvalidation, options.getRevision());
        if (payload.revision <= latestInvalidation) return;

        latestInvalidation = payload.revision;
        void options.refetch();
    };
}