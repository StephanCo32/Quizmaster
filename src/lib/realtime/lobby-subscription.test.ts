import { describe, expect, it, vi } from "vitest";
import { canWriteLobby, subscribeToLobby, type LobbyConnectionState } from "./lobby-subscription";

function harness(revision = 3) {
    let broadcast: ((message: { payload?: unknown }) => void) | undefined;
    let status: ((status: string) => void) | undefined;
    const channel = {
        on: vi.fn((_type, _filter, callback) => { broadcast = callback; return channel; }),
        subscribe: vi.fn((callback) => { status = callback; return channel; }),
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn().mockResolvedValue("ok") };
    const refetch = vi.fn().mockResolvedValue(undefined);
    const states: LobbyConnectionState[] = [];
    const unsubscribe = subscribeToLobby({ client, gameSessionId: "session-1", getRevision: () => revision, refetch, onConnectionState: (state) => states.push(state) });
    return { broadcast: (payload: unknown) => broadcast?.({ payload }), client, refetch, states, status: (value: string) => status?.(value), unsubscribe };
}

describe("Lobby subscription", () => {
    it("refetches for a newer matching invalidation and ignores repeated or stale versions", async () => {
        const subscription = harness();
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        subscription.broadcast({ gameSessionId: "session-1", revision: 3 });
        subscription.broadcast({ gameSessionId: "another-session", revision: 5 });
        await Promise.resolve();
        expect(subscription.refetch).toHaveBeenCalledOnce();
    });

    it("reports connection loss and refetches after reconnect", async () => {
        const subscription = harness();
        subscription.status("SUBSCRIBED");
        subscription.status("CHANNEL_ERROR");
        subscription.status("SUBSCRIBED");
        await vi.waitFor(() => expect(subscription.states).toEqual(["connected", "disconnected", "reconnecting", "connected"]));
        expect(subscription.refetch).toHaveBeenCalledOnce();
    });

    it("disables writes when an invalidation cannot be refetched", async () => {
        const subscription = harness();
        subscription.status("SUBSCRIBED");
        subscription.refetch.mockRejectedValueOnce(new Error("unavailable"));
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await vi.waitFor(() => expect(subscription.states.at(-1)).toBe("disconnected"));
    });

    it("removes its channel when disposed", async () => {
        const subscription = harness();
        await subscription.unsubscribe();
        expect(subscription.client.removeChannel).toHaveBeenCalledOnce();
    });

    it("allows writes only while synchronization is connected", () => {
        expect(canWriteLobby("connected")).toBe(true);
        expect(canWriteLobby("connecting")).toBe(false);
        expect(canWriteLobby("disconnected")).toBe(false);
        expect(canWriteLobby("reconnecting")).toBe(false);
    });
});