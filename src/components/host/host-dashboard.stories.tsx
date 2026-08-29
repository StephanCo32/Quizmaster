import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HostDashboard } from "./host-dashboard";

const parties = [
    {
        party_id: "a1111111-1111-4111-8111-111111111111",
        party_code: "ON7AIR",
        game_session_id: "b1111111-1111-4111-8111-111111111111",
        game_session_state: "setup" as const,
        revision: 0,
        created_at: "2026-08-23T18:00:00.000Z",
        display_active: false,
    },
];

const meta = {
    title: "Host/Dashboard",
    component: HostDashboard,
    parameters: { viewport: { defaultViewport: "host" } },
    args: { hostEmail: "host@example.com", parties, isContentAdmin: true },
} satisfies Meta<typeof HostDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
    args: { parties: [] },
};

export const Creating: Story = {
    args: { initialCreateStatus: "creating" },
};

export const CreationFailure: Story = {
    args: { initialCreateStatus: "error" },
};

export const Disconnected: Story = {
    args: { connectionState: "disconnected" },
};