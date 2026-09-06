import { afterEach, describe, expect, it, vi } from "vitest";
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
    return { broadcast: (payload: unknown) => broadcast?.({ payload }), client, refetch, states, status: (value: string) => status?.(value), setRevision: (value: number) => { revision = value; }, unsubscribe };
}

describe("Lobby subscription", () => {
    afterEach(() => vi.useRealTimers());

    it("ignores stale, foreign, malformed and duplicate invalidations", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        for (const payload of [
            { gameSessionId: "session-1", revision: 3 },
            { gameSessionId: "session-2", revision: 4 },
            { gameSessionId: "session-1", revision: 1.5 },
            { unexpected: "payload" },
        ]) subscription.broadcast(payload);
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).not.toHaveBeenCalled();
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await vi.advanceTimersByTimeAsync(1000);
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).toHaveBeenCalledOnce();
        await subscription.unsubscribe();
    });

    it("bounds sustained traffic without indefinitely postponing updates", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        for (let revision = 4; revision < 24; revision++) {
            subscription.broadcast({ gameSessionId: "session-1", revision });
            await vi.advanceTimersByTimeAsync(100);
        }
        expect(subscription.refetch.mock.calls.length).toBeGreaterThanOrEqual(3);
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch.mock.calls.length).toBeLessThanOrEqual(4);
        await subscription.unsubscribe();
    });

    it("skips a queued broadcast already covered by another refresh", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        subscription.setRevision(4);
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).not.toHaveBeenCalled();
        await subscription.unsubscribe();
    });

    it("does not spin on failed requests or synchronous errors", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        subscription.refetch.mockImplementation(() => { throw new Error("unavailable"); });
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await vi.advanceTimersByTimeAsync(30000);
        expect(subscription.refetch).toHaveBeenCalledOnce();
        expect(subscription.states).toEqual(["disconnected"]);
        await subscription.unsubscribe();
    });

    it("batches a burst of caption invalidations across many viewers", async () => {
        vi.useFakeTimers();
        const viewers = Array.from({ length: 20 }, () => harness());
        for (let revision = 4; revision < 24; revision++) {
            for (const viewer of viewers) viewer.broadcast({ gameSessionId: "session-1", revision });
            await vi.advanceTimersByTimeAsync(10);
        }
        await vi.advanceTimersByTimeAsync(1000);
        for (const viewer of viewers) {
            expect(viewer.refetch).toHaveBeenCalledOnce();
            await viewer.unsubscribe();
        }
    });

    it("fetches an update received during a running request exactly once afterwards", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        let finish: (() => void) | undefined;
        subscription.refetch.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).toHaveBeenCalledOnce();
        subscription.broadcast({ gameSessionId: "session-1", revision: 5 });
        subscription.broadcast({ gameSessionId: "session-1", revision: 6 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).toHaveBeenCalledOnce();
        finish!();
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(5000);
        expect(subscription.refetch).toHaveBeenCalledTimes(2);
        await subscription.unsubscribe();
    });

    it("cancels scheduled refreshes when leaving a session", async () => {
        vi.useFakeTimers();
        const subscription = harness();
        subscription.broadcast({ gameSessionId: "session-1", revision: 4 });
        await subscription.unsubscribe();
        await vi.advanceTimersByTimeAsync(1000);
        expect(subscription.refetch).not.toHaveBeenCalled();
    });

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