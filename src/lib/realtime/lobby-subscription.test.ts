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
    const refetch = vi.fn<() => Promise<void>>().mockResolvedValue();
    const states: LobbyConnectionState[] = [];
    const unsubscribe = subscribeToLobby({ client, gameSessionId: "session-1", getRevision: () => revision, refetch, onConnectionState: (state) => states.push(state) });
    return { broadcast: (payload: unknown) => broadcast?.({ payload }), client, refetch, states, status: (value: string) => status?.(value), unsubscribe };
}

describe("Lobby subscription", () => {
    it("retains the connection contract across a missed invalidation and reconnect", async () => {
        const subscription = harness();

        subscription.status("SUBSCRIBED");
        subscription.status("CHANNEL_ERROR");
        subscription.status("SUBSCRIBED");

        await vi.waitFor(() => expect(subscription.states).toEqual(["connected", "disconnected", "reconnecting", "connected"]));
        expect(subscription.refetch).toHaveBeenCalledOnce();
    });

    it("remains disconnected when the recovery projection cannot be fetched", async () => {
        const subscription = harness();
        subscription.status("SUBSCRIBED");
        subscription.status("CHANNEL_ERROR");
        subscription.refetch.mockRejectedValueOnce(new Error("unavailable"));

        subscription.status("SUBSCRIBED");

        await vi.waitFor(() =>
            expect(subscription.states).toEqual([
                "connected",
                "disconnected",
                "reconnecting",
                "disconnected",
            ]),
        );
        expect(canWriteLobby(subscription.states.at(-1)!)).toBe(false);
    });

    it("locks writes outside the connected state", () => {
        expect(canWriteLobby("connected")).toBe(true);
        expect(canWriteLobby("connecting")).toBe(false);
        expect(canWriteLobby("disconnected")).toBe(false);
        expect(canWriteLobby("reconnecting")).toBe(false);
    });
});