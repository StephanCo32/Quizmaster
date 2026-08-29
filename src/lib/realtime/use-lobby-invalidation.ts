"use client";

import { useEffect, useEffectEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { lobbyChannel, lobbyInvalidationEvent } from "./lobby-events";
import { createLobbyInvalidationHandler } from "./lobby-invalidation-client";

export function useLobbyInvalidation(options: { gameSessionId: string; revision: number; refetch: () => Promise<void> }) {
    const getRevision = useEffectEvent(() => options.revision);
    const refetch = useEffectEvent(() => options.refetch());

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        const handleInvalidation = createLobbyInvalidationHandler({
            gameSessionId: options.gameSessionId,
            getRevision,
            refetch,
        });
        const channel = supabase
            .channel(lobbyChannel(options.gameSessionId))
            .on("broadcast", { event: lobbyInvalidationEvent }, (message) => {
                handleInvalidation(message.payload);
            })
            .subscribe();

        return () => { void supabase.removeChannel(channel as RealtimeChannel); };
    }, [options.gameSessionId]);
}