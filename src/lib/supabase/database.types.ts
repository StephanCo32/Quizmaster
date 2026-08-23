export type PartyProjection = {
    party_id: string;
    party_code: string;
    game_session_id: string;
    game_session_state: "setup" | "lobby" | "live" | "finished";
    revision: number;
    created_at: string;
};

export type CreatePartyResult = {
    party_id: string;
    party_code: string;
    game_session_id: string;
    revision: number;
};

export type Database = {
    public: {
        Tables: Record<string, never>;
        Views: Record<string, never>;
        Functions: {
            create_party: {
                Args: {
                    p_host_id: string;
                    p_command_id: string;
                    p_expected_revision: number;
                };
                Returns: CreatePartyResult[];
            };
            host_parties_projection: {
                Args: { p_host_id: string };
                Returns: PartyProjection[];
            };
            host_party_projection: {
                Args: { p_host_id: string; p_party_id: string };
                Returns: PartyProjection[];
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};