import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CreatePartyResult, PartyProjection } from "@/lib/supabase/database.types";

export async function listHostParties(hostId: string): Promise<PartyProjection[]> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("host_parties_projection", {
        p_host_id: hostId,
    });

    if (error) {
        throw new Error("host_projection_unavailable", { cause: error });
    }

    return data;
}

export async function getHostParty(hostId: string, partyId: string) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("host_party_projection", {
        p_host_id: hostId,
        p_party_id: partyId,
    });

    if (error) {
        throw new Error("host_projection_unavailable", { cause: error });
    }

    return data.at(0) ?? null;
}

export async function createParty(command: {
    hostId: string;
    commandId: string;
    expectedRevision: number;
}): Promise<CreatePartyResult> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("create_party", {
        p_host_id: command.hostId,
        p_command_id: command.commandId,
        p_expected_revision: command.expectedRevision,
    });

    if (error) {
        if (error.code === "40001" || error.message === "stale_revision") {
            throw new Error("stale_revision");
        }

        throw new Error("party_creation_failed", { cause: error });
    }

    const result = data.at(0);
    if (!result) {
        throw new Error("party_creation_failed");
    }

    return result;
}

async function mutatePartyLifecycle(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }, rpc: "finish_game_session" | "close_party" | "create_successor_game_session"): Promise<import("@/lib/supabase/database.types").LobbyCommandResult> { const { data, error } = await createSupabaseAdminClient().rpc(rpc, { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision }); if (error) throw new Error(error.code === "40001" ? error.message : "lifecycle_failed", { cause: error }); const result = data.at(0); if (!result) throw new Error("lifecycle_failed"); return result; }
export const finishGameSession = (command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) => mutatePartyLifecycle(command, "finish_game_session");
export const closeParty = (command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) => mutatePartyLifecycle(command, "close_party");
export const createSuccessorGameSession = (command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) => mutatePartyLifecycle(command, "create_successor_game_session");
export async function adjustPartyScore(command: { hostId: string; partyId: string; memberId: string; commandId: string; expectedRevision: number; delta: number }) { const { data, error } = await createSupabaseAdminClient().rpc("adjust_party_score", { p_host_id: command.hostId, p_party_id: command.partyId, p_member_id: command.memberId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision, p_delta: command.delta }); if (error) throw new Error(error.code === "40001" ? error.message : "score_adjustment_failed", { cause: error }); return data.at(0); }
export async function deleteParty(command: { hostId: string; partyId: string; commandId: string; expectedRevision: number }) { const { data, error } = await createSupabaseAdminClient().rpc("delete_party", { p_host_id: command.hostId, p_party_id: command.partyId, p_command_id: command.commandId, p_expected_revision: command.expectedRevision }); if (error || !data) throw new Error("party_deletion_failed", { cause: error }); }