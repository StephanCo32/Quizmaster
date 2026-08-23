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