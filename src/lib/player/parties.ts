import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function joinParty(command: { playerId: string; commandId: string; partyCode: string; nickname: string }) {
    const { data, error } = await createSupabaseAdminClient().rpc("join_party", { p_player_id: command.playerId, p_command_id: command.commandId, p_party_code: command.partyCode, p_nickname: command.nickname });
    if (error) {
        const mapped = error.code === "23505" ? "nickname_taken" : error.message;
        throw new Error(mapped, { cause: error });
    }
    const result = data.at(0);
    if (!result) throw new Error("join_failed");
    return result;
}

export async function openPartyLobby(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("open_party_lobby", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "lobby_open_failed", { cause: error });
    return data;
}
