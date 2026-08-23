import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PartyMemberProjection } from "@/lib/supabase/database.types";

export async function joinParty(command: { playerId: string; commandId: string; partyCode: string; nickname: string; expectedRevision: number }): Promise<PartyMemberProjection> {
    const { data, error } = await createSupabaseAdminClient().rpc("join_party", { p_player_id: command.playerId, p_command_id: command.commandId, p_party_code: command.partyCode, p_nickname: command.nickname, p_expected_revision: command.expectedRevision });
    if (error) {
        const mapped = error.code === "23505" ? "nickname_taken" : error.message;
        throw new Error(mapped, { cause: error });
    }
    const result = data.at(0);
    if (!result) throw new Error("join_failed");
    return result;
}

export async function changeNickname(command: { playerId: string; memberId: string; commandId: string; nickname: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("change_party_member_nickname", { p_player_id: command.playerId, p_member_id: command.memberId, p_command_id: command.commandId, p_nickname: command.nickname, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "23505" ? "nickname_taken" : error.code === "40001" ? "stale_revision" : "nickname_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("nickname_change_failed");
    return result;
}

export async function setReady(command: { playerId: string; memberId: string; commandId: string; ready: boolean; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("set_party_member_ready", { p_player_id: command.playerId, p_member_id: command.memberId, p_command_id: command.commandId, p_ready: command.ready, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "ready_change_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("ready_change_failed");
    return result;
}

export async function getPlayerPartyLobby(playerId: string, partyCode: string): Promise<PartyMemberProjection[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("player_party_lobby_projection", { p_player_id: playerId, p_party_code: partyCode });
    if (error) throw new Error("player_projection_unavailable", { cause: error });
    return data;
}

export async function getHostPartyLobby(hostId: string, partyId: string): Promise<PartyMemberProjection[]> {
    const { data, error } = await createSupabaseAdminClient().rpc("host_party_lobby_projection", { p_host_id: hostId, p_party_id: partyId });
    if (error) throw new Error("host_lobby_projection_unavailable", { cause: error });
    return data;
}

export async function getPartyLobbyStatus(partyCode: string) {
    const { data, error } = await createSupabaseAdminClient().rpc("party_lobby_status", { p_party_code: partyCode });
    if (error) throw new Error("party_status_unavailable", { cause: error });
    return data.at(0) ?? null;
}

export async function openPartyLobby(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) {
    const { data, error } = await createSupabaseAdminClient().rpc("open_party_lobby", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision });
    if (error) throw new Error(error.code === "40001" ? "stale_revision" : "lobby_open_failed", { cause: error });
    const result = data.at(0);
    if (!result) throw new Error("lobby_open_failed");
    return result;
}
