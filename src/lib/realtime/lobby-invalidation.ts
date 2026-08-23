import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { lobbyChannel, lobbyInvalidationEvent, type LobbyInvalidation } from "@/lib/realtime/lobby-events";

export async function publishLobbyInvalidation(invalidation: LobbyInvalidation) {
    const supabase = createSupabaseAdminClient();
    const channel = supabase.channel(lobbyChannel(invalidation.gameSessionId));

    try {
        await channel.httpSend(lobbyInvalidationEvent, invalidation);
        return true;
    } catch (error) {
        console.error("Lobby invalidation publication failed", { cause: error });
        return false;
    } finally {
        await supabase.removeChannel(channel).catch(() => undefined);
    }
}