# Storybook: Architecture, Mechanics, and Origins

> Research note. No existing convention for research notes existed in this repo (`docs/` previously only had `adr/` and `agents/`), so this lives under a new `docs/research/` directory.

## Summary

**How does Storybook work?** Storybook is a frontend workshop that renders UI components in isolated iframes for development and testing. Stories are declarative objects (Component Story Format) that define a component's props/state for one "interesting" variation. A framework-specific builder (Webpack or Vite) compiles the story files into a static app with two parts: a "manager" (sidebar, toolbar, addon panels) and a "preview" (the iframe rendering the actual component), connected by an addon channel.

**Is it exclusively for Copilot / AI agentic programming?** No. Storybook is a general-purpose, open-source UI development tool created by the team behind Chromatic, predating mainstream AI coding agents by many years (current major version is 10, with a release history going back to Storybook 1–5+ and a large open-source community). Its original and primary purpose is **component-driven development**: building, documenting, and testing UI components in isolation for human developers and design systems. Storybook's docs do now include an "AI" section (agentic setup, manifests) as a recent addition, but that is a feature layered on top of the existing tool, not its founding purpose.

---

## How Storybook works

### What is a story?

A **story** captures the rendered state of a UI component — a declarative object specifying the props/mock data needed to render one "interesting" state. Per the [official docs](https://storybook.js.org/docs/get-started/whats-a-story): "A story captures the rendered state of a UI component. Developers write multiple stories per component that describe all the 'interesting' states a component can support."

This repo's [host-dashboard.stories.tsx](../../src/components/host/host-dashboard.stories.tsx) demonstrates this directly: the same `HostDashboard` component is rendered multiple times — `Populated`, `Empty`, `Creating`, `CreationFailure`, `Disconnected` — each just a different `args` object.

### Component Story Format (CSF)

Stories are written in **Component Story Format (CSF)**, an [open standard based on ES modules](https://storybook.js.org/docs/api/csf): a file's default export holds metadata (component reference, sidebar `title`, shared `args`/`parameters`), and each named export is one story. Example from [party-setup.stories.tsx](../../src/components/host/party-setup.stories.tsx):

```ts
const meta = {
    title: "Host/Party Setup",
    component: PartySetup,
    parameters: { viewport: { defaultViewport: "host" } },
    args: { roster: [], rounds: [], templates: [], /* ... */ },
} satisfies Meta<typeof PartySetup>;

export default meta;
export const Setup: Story = {};
```

### Build system and isolation

Storybook uses a **framework adapter + builder** (Webpack or Vite) to compile story files, component source, and addons into a standalone app, distinct from the app's own build. This repo uses `@storybook/nextjs-vite` (see [.storybook/main.ts](../../.storybook/main.ts)), which understands Next.js config while using Vite for fast builds — confirmed by [node_modules/@storybook/nextjs-vite/package.json](../../node_modules/@storybook/nextjs-vite/package.json).

Each story renders inside a **fully isolated iframe**, with no access to the app's own providers, routing, or global state unless a story/decorator supplies it. Per the [official "Why Storybook" doc](https://storybook.js.org/docs/get-started/why-storybook): "Storybook is packaged as a small, development-only workshop that lives alongside your app. It provides an isolated iframe to render components without interference from app business logic and context."

The UI splits into:
- **Manager**: sidebar, toolbar, and addon panels (Controls, Actions, Accessibility, etc.) — outside the iframe.
- **Preview**: the iframe itself, containing only the rendered story.

### Configuration files

- **`.storybook/main.ts`** ([this repo's copy](../../.storybook/main.ts)): declares the `stories` glob (`../src/**/*.stories.@(ts|tsx)`), the `framework` adapter (`@storybook/nextjs-vite`), and loaded `addons` (`@storybook/addon-a11y`).
- **`.storybook/preview.ts`** ([this repo's copy](../../.storybook/preview.ts)): global `parameters` applied to every story — `layout: "fullscreen"`, `a11y: { test: "error" }` (fail stories on accessibility violations), `nextjs.appDirectory: true`, and a custom `host` viewport (1440×900) for the viewport addon.

### Args, Controls, and addons

**Args** are the props passed into a story; they double as live-editable fields in the **Controls** addon panel. [Essential addons](https://storybook.js.org/docs/essentials) include Controls (live prop editing), Actions (logs callback invocations, e.g. click handlers), Viewport (renders at different device sizes), and A11y (runs an Axe accessibility audit per story). This repo only explicitly loads `@storybook/addon-a11y`, plus the built-in viewport parameters for a custom "host" size.

### How this differs from running the real app

| Aspect | Storybook | Full app |
|---|---|---|
| Isolation | Iframe sandbox, no app context | Full app state, routing, auth |
| Startup | Renders one component instantly | Full boot: data fetching, auth, init |
| State | Explicit via `args`/decorators | Implicit, from real app state |
| Mocking | Trivial — supply args/decorators | Needs real or stubbed services |

---

## Origins and primary purpose

Storybook is an open-source project historically built and maintained by the team behind **Chromatic**, with a large community of contributors, hosted at [github.com/storybookjs/storybook](https://github.com/storybookjs/storybook) (MIT licensed — see the repo's [LICENSE](https://github.com/storybookjs/storybook/blob/main/LICENSE)). This repo currently runs Storybook **10.5.10** locally ([node_modules/storybook/package.json](../../node_modules/storybook/package.json)), and the project's release history (migration guides going back to Storybook 5 and earlier) shows it predates the rise of mainstream AI coding agents by years.

Its stated purpose, per the [official docs](https://storybook.js.org/docs/get-started/why-storybook), is to solve **component-driven development** at scale: "Mature projects can contain hundreds of components that yield thousands of discrete variations... Developers must consider countless UI variations, yet aren't equipped to develop or organize them all." Storybook addresses this by giving each variation its own story, browsable and testable independently of the running app. This aligns with the [Component-Driven Development](https://componentdriven.org/) philosophy that Storybook's own docs cite as foundational.

Storybook is used for: isolated UI development, living documentation of components for a team, automated visual/accessibility/interaction testing, and centralizing a design system's component variants — all pre-dating and independent of AI tooling.

**On the Copilot/agentic question specifically**: current Storybook docs do include an ["AI" section](https://storybook.js.org/docs/ai) covering "agentic setup" and machine-readable manifests — a recent addition reflecting that AI agents (like this one) can also read/drive Storybook. But this is layered on top of a tool whose core design and decade-plus history is about human component-driven development, not something built for or exclusive to Copilot/agents.

---

## How this repo uses it

- **Framework**: `@storybook/nextjs-vite`, wired in [.storybook/main.ts](../../.storybook/main.ts), so stories understand this project's Next.js app-directory config.
- **Story location/convention**: `*.stories.tsx` next to the component, e.g. [src/components/host/host-dashboard.stories.tsx](../../src/components/host/host-dashboard.stories.tsx), [host-sign-in.stories.tsx](../../src/components/host/host-sign-in.stories.tsx), [party-setup.stories.tsx](../../src/components/host/party-setup.stories.tsx).
- **Global styling**: [.storybook/preview.ts](../../.storybook/preview.ts) imports `../src/app/globals.css` directly so stories render with the app's real CSS.
- **Addons in use**: `@storybook/addon-a11y` only, plus a custom `host` viewport size (1440×900) declared in `preview.ts`.
- Recently, a throwaway story (`Prototype/Voting Row Contrast`) was used in this same session to visually verify a CSS contrast fix before committing to it — an example of using Storybook for quick, isolated UI verification outside the full app flow.

---

## Sources

**Official Storybook documentation**
- https://storybook.js.org/ — home page
- https://storybook.js.org/docs/get-started/whats-a-story — story concept, CSF
- https://storybook.js.org/docs/get-started/why-storybook — problem/solution framing, iframe isolation
- https://storybook.js.org/docs/api/csf — Component Story Format spec
- https://storybook.js.org/docs/essentials — Controls/Actions/Viewport/A11y addons
- https://storybook.js.org/docs/ai — the "AI"/agentic setup section

**Official GitHub repository**
- https://github.com/storybookjs/storybook — source, contributors, issue tracker
- https://github.com/storybookjs/storybook/blob/main/LICENSE — MIT license

**Local project files (ground truth for this repo)**
- [.storybook/main.ts](../../.storybook/main.ts)
- [.storybook/preview.ts](../../.storybook/preview.ts)
- [src/components/host/host-dashboard.stories.tsx](../../src/components/host/host-dashboard.stories.tsx)
- [src/components/host/host-sign-in.stories.tsx](../../src/components/host/host-sign-in.stories.tsx)
- [src/components/host/party-setup.stories.tsx](../../src/components/host/party-setup.stories.tsx)
- [node_modules/storybook/package.json](../../node_modules/storybook/package.json)
- [node_modules/@storybook/nextjs-vite/package.json](../../node_modules/@storybook/nextjs-vite/package.json)

**Referenced standard**
- https://componentdriven.org/ — Component-Driven Development philosophy cited by Storybook's own docs
