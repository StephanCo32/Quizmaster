import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HostSignIn } from "./host-sign-in";

const meta = {
    title: "Host/Authentication",
    component: HostSignIn,
    parameters: { viewport: { defaultViewport: "host" } },
} satisfies Meta<typeof HostSignIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Sending: Story = {
    args: { initialStatus: "sending" },
};

export const Sent: Story = {
    args: { initialStatus: "sent" },
};

export const CallbackFailure: Story = {
    args: { callbackFailed: true },
};