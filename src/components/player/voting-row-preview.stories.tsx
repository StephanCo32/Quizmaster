import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VotingRowPreview } from "./voting-row-preview";

// THROWAWAY PROTOTYPE — delete this file and voting-row-preview.tsx after the contrast fix is confirmed.
const meta = {
    title: "Prototype/Voting Row Contrast",
    component: VotingRowPreview,
} satisfies Meta<typeof VotingRowPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
