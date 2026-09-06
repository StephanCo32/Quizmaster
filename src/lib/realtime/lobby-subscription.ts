import { lobbyChannel, lobbyInvalidationEvent, type LobbyInvalidation } from "./lobby-events";

export type LobbyConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export function canWriteLobby(state: LobbyConnectionState) {
    return state === "connected";
}

export type LobbyChannel = {
    on: (type: "broadcast", filter: { event: string }, callback: (message: { payload?: unknown }) => void) => LobbyChannel;
    subscribe: (callback: (status: string) => void) => LobbyChannel;
};

type RealtimeClient = {
    channel: (name: string) => LobbyChannel;
    removeChannel: (channel: LobbyChannel) => Promise<unknown>;
};

type LobbySubscriptionOptions = {
    client: RealtimeClient;
    gameSessionId: string;
    getRevision: () => number;
    refetch: () => Promise<void>;
    onConnectionState: (state: LobbyConnectionState) => void;
};

function isLobbyInvalidation(value: unknown): value is LobbyInvalidation {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<LobbyInvalidation>;
    return typeof candidate.gameSessionId === "string" && typeof candidate.revision === "number" && Number.isSafeInteger(candidate.revision);
}

export function subscribeToLobby(options: LobbySubscriptionOptions) {
    let connectedOnce = false;
    let refresh: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingRevision: number | null = null;
    let newestRevision = options.getRevision();
    let disposed = false;

    function setConnectionState(state: LobbyConnectionState) {
        if (!disposed) options.onConnectionState(state);
    }

    function scheduleRefresh() {
        if (disposed || timer !== null || refresh) return;
        timer = setTimeout(() => {
            timer = null;
            if (pendingRevision === null || pendingRevision <= options.getRevision()) {
                pendingRevision = null;
                return;
            }
            void refetch().catch(() => setConnectionState("disconnected"));
        }, 500 + Math.floor(Math.random() * 100));
    }

    function refetch() {
        if (!refresh) {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            pendingRevision = null;
            refresh = Promise.resolve().then(() => options.refetch()).catch((error) => {
                pendingRevision = null;
                throw error;
            }).finally(() => {
                refresh = null;
                if (pendingRevision !== null) scheduleRefresh();
            });
        }
        return refresh;
    }

    const channel = options.client
        .channel(lobbyChannel(options.gameSessionId))
        .on("broadcast", { event: lobbyInvalidationEvent }, (message) => {
            if (disposed) return;
            if (!isLobbyInvalidation(message.payload)) return;
            if (message.payload.gameSessionId !== options.gameSessionId || message.payload.revision <= Math.max(options.getRevision(), newestRevision)) return;
            newestRevision = message.payload.revision;
            pendingRevision = message.payload.revision;
            scheduleRefresh();
        })
        .subscribe((status) => {
            if (disposed) return;
            if (status === "SUBSCRIBED") {
                if (!connectedOnce) {
                    connectedOnce = true;
                    setConnectionState("connected");
                    return;
                }

                setConnectionState("reconnecting");
                void refetch().then(
                    () => setConnectionState("connected"),
                    () => setConnectionState("disconnected"),
                );
                return;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                setConnectionState("disconnected");
            }
        });

    return () => {
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        pendingRevision = null;
        return options.client.removeChannel(channel);
    };
}