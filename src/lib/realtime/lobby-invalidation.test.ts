import { beforeEach, describe, expect, it, vi } from "vitest";

const { channel, createSupabaseAdminClient, httpSend, removeChannel } = vi.hoisted(() => {
    const httpSend = vi.fn();
    const removeChannel = vi.fn();
    const channel = { httpSend };
    const createSupabaseAdminClient = vi.fn(() => ({
        channel: vi.fn(() => channel),
        removeChannel,
    }));

    return { channel, createSupabaseAdminClient, httpSend, removeChannel };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));

import {
    publishLobbyInvalidation,
} from "./lobby-invalidation";
import { lobbyChannel, lobbyInvalidationEvent } from "./lobby-events";

describe("Lobby invalidations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        httpSend.mockResolvedValue({ success: true });
        removeChannel.mockResolvedValue("ok");
    });

    it("publishes only the Game session identity and projection revision", async () => {
        const invalidation = { gameSessionId: "session-1", revision: 4 };

        await publishLobbyInvalidation(invalidation);

        const client = createSupabaseAdminClient.mock.results[0]?.value;
        expect(client?.channel).toHaveBeenCalledWith("game-session:session-1");
        expect(httpSend).toHaveBeenCalledWith(lobbyInvalidationEvent, invalidation);
        expect(removeChannel).toHaveBeenCalledWith(channel);
    });

    it("does not fail a committed command when publication fails", async () => {
        httpSend.mockRejectedValue(new Error("unavailable"));
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(publishLobbyInvalidation({ gameSessionId: "session-1", revision: 4 }))
            .resolves.toBe(false);
        expect(error).toHaveBeenCalledOnce();
        expect(removeChannel).toHaveBeenCalledWith(channel);
    });

    it("uses a Game-session-scoped channel", () => {
        expect(lobbyChannel("session-1")).toBe("game-session:session-1");
    });
});