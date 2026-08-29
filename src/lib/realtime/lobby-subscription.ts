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

    function refetch() {
        if (!refresh) refresh = options.refetch().finally(() => { refresh = null; });
        return refresh;
    }

    const channel = options.client
        .channel(lobbyChannel(options.gameSessionId))
        .on("broadcast", { event: lobbyInvalidationEvent }, (message) => {
            if (!isLobbyInvalidation(message.payload)) return;
            if (message.payload.gameSessionId !== options.gameSessionId || message.payload.revision <= options.getRevision()) return;
            void refetch().catch(() => options.onConnectionState("disconnected"));
        })
        .subscribe((status) => {
            if (status === "SUBSCRIBED") {
                if (!connectedOnce) {
                    connectedOnce = true;
                    options.onConnectionState("connected");
                    return;
                }

                options.onConnectionState("reconnecting");
                void refetch().then(
                    () => options.onConnectionState("connected"),
                    () => options.onConnectionState("disconnected"),
                );
                return;
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                options.onConnectionState("disconnected");
            }
        });

    return () => options.client.removeChannel(channel);
}