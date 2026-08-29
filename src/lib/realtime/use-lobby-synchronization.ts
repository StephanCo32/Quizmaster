"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { subscribeToLobby, type LobbyChannel, type LobbyConnectionState } from "./lobby-subscription";

export function useLobbySynchronization(options: { gameSessionId: string; revision: number; refetch: () => Promise<void> }) {
    const [connection, setConnection] = useState({ gameSessionId: options.gameSessionId, state: "connecting" as LobbyConnectionState });
    const getRevision = useEffectEvent(() => options.revision);
    const refetch = useEffectEvent(() => options.refetch());

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        const unsubscribe = subscribeToLobby({
            client: {
                channel: (name) => supabase.channel(name),
                removeChannel: (channel: LobbyChannel) => supabase.removeChannel(channel as RealtimeChannel),
            },
            gameSessionId: options.gameSessionId,
            getRevision,
            refetch,
            onConnectionState: (state) => setConnection({ gameSessionId: options.gameSessionId, state }),
        });

        return () => { void unsubscribe(); };
    }, [options.gameSessionId]);

    return connection.gameSessionId === options.gameSessionId ? connection.state : "connecting";
}