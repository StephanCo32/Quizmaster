import type { StorybookConfig } from "@storybook/nextjs-vite";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "storybook-publishable-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "storybook-service-role-key";

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(ts|tsx)"],
    addons: ["@storybook/addon-a11y"],
    framework: {
        name: "@storybook/nextjs-vite",
        options: {},
    },
};

export default config;