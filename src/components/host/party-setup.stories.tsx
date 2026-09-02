import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PartySetup } from "./party-setup";

const meta = {
    title: "Host/Party Setup",
    component: PartySetup,
    parameters: { viewport: { defaultViewport: "host" } },
    args: {
        roster: [],
        rounds: [],
        templates: [],
        initialSubmissions: [],
        initialCompletion: null,
        initialBallots: [],
        initialRevealCandidates: [],
        party: {
            party_id: "a1111111-1111-4111-8111-111111111111",
            party_code: "ON7AIR",
            game_session_id: "b1111111-1111-4111-8111-111111111111",
            game_session_state: "setup",
            revision: 0,
            created_at: "2026-08-23T18:00:00.000Z",
            display_active: false,
        },
    },
} satisfies Meta<typeof PartySetup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Setup: Story = {};