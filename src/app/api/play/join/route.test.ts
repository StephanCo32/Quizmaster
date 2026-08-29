import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, joinParty, publishLobbyInvalidation } = vi.hoisted(() => ({
    cookieStore: { get: vi.fn(), has: vi.fn(), set: vi.fn() },
    joinParty: vi.fn(),
    publishLobbyInvalidation: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue(cookieStore) }));
vi.mock("@/lib/player/parties", () => ({ joinParty }));
vi.mock("@/lib/realtime/lobby-invalidation", () => ({ publishLobbyInvalidation }));

import { POST } from "./route";

const command = {
    commandId: "11111111-1111-4111-8111-111111111111",
    partyCode: "ABC123",
    nickname: "Ada",
    expectedRevision: 1,
};

describe("POST /api/play/join", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookieStore.get.mockReturnValue({ value: "66666666-6666-4666-8666-666666666666" });
        cookieStore.has.mockReturnValue(true);
        publishLobbyInvalidation.mockResolvedValue(true);
    });

    it("publishes the committed Game session revision", async () => {
        joinParty.mockResolvedValue({ member_id: "member-1", game_session_id: "session-1", session_revision: 2 });

        const response = await POST(new Request("http://localhost/api/play/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        }));

        expect(response.status).toBe(200);
        expect(publishLobbyInvalidation).toHaveBeenCalledWith({ gameSessionId: "session-1", revision: 2 });
    });

    it("does not publish a rejected command", async () => {
        joinParty.mockRejectedValue(new Error("stale_revision"));

        const response = await POST(new Request("http://localhost/api/play/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        }));

        expect(response.status).toBe(409);
        expect(publishLobbyInvalidation).not.toHaveBeenCalled();
    });

    it.each(["joining_closed", "player_removed", "party_not_found"])("does not disclose %s", async (reason) => {
        joinParty.mockRejectedValue(new Error(reason));

        const response = await POST(new Request("http://localhost/api/play/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        }));

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ error: "not_found" });
        expect(publishLobbyInvalidation).not.toHaveBeenCalled();
    });
});