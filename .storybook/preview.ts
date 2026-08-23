import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
    parameters: {
        layout: "fullscreen",
        a11y: { test: "error" },
        nextjs: { appDirectory: true },
        viewport: {
            options: {
                host: { name: "Host 1440 × 900", styles: { width: "1440px", height: "900px" } },
            },
        },
    },
};

export default preview;