import { describe, expect, it, vi } from "vitest";
import { createLobbyInvalidationHandler } from "./lobby-invalidation-client";

describe("Lobby invalidation handler", () => {
    it("refetches once for a newer matching Game session", () => {
        const refetch = vi.fn<() => Promise<void>>().mockResolvedValue();
        const handleInvalidation = createLobbyInvalidationHandler({ gameSessionId: "session-1", getRevision: () => 3, refetch });

        handleInvalidation({ gameSessionId: "session-1", revision: 4 });
        handleInvalidation({ gameSessionId: "session-1", revision: 4 });

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("ignores stale, foreign, and malformed invalidations", () => {
        const refetch = vi.fn<() => Promise<void>>().mockResolvedValue();
        const handleInvalidation = createLobbyInvalidationHandler({ gameSessionId: "session-1", getRevision: () => 3, refetch });

        handleInvalidation({ gameSessionId: "session-1", revision: 3 });
        handleInvalidation({ gameSessionId: "session-2", revision: 4 });
        handleInvalidation({ gameSessionId: "session-1", revision: 1.5 });
        handleInvalidation({ unexpected: "payload" });

        expect(refetch).not.toHaveBeenCalled();
    });
});