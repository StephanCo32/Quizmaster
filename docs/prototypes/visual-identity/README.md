# Quizmaster visual identity prototype

## Decision

Select **Variant A: Playful board**. It takes the useful qualities of Gartic on Stream - immediate playfulness, pastel color fields, bold outlines, obvious game state, and low-friction readability - without copying its brand assets or screen compositions.

Reference screens:

- [Host, 1440 x 900](a-host.png)
- [Player, 390 x 844](a-player.png)
- [Public Display, 1920 x 1080](a-display.png)

Contrast directions:

- Variant B, **Paper party**, is too editorial and restrained for fast room play.
- Variant C, **Broadcast blocks**, is legible but reads as streaming operations software and makes the event feel less social.

## Character and guardrails

Quizmaster is a friendly live game board: buoyant, direct, tactile, and slightly handmade. Real game media remains the loudest visual element; the interface frames it with flat pastel fields, near-black outlines, compact stickers, and offset hard shadows.

Do not use generic SaaS card grids, glass effects, gradient blobs, casino neon, dark esports styling, childish illustration overload, pill-shaped containers for every label, or color as the only carrier of meaning. Pastels are accents on a high-contrast ink-and-paper foundation, not low-contrast text surfaces.

## Role hierarchy

- **Host**: desktop command deck. Use a roughly 3:1 stage/control split, compact information density, persistent timer and connection state, and one unmistakable primary action.
- **Player**: mobile play sheet. Use one column, one decision at a time, controls at least 48 px high, 16 px edge clearance, and no essential information available only through hover.
- **Public Display**: room-scale game board. Use a roughly 3:1 stage/score split, no scrolling at 1920 x 1080, body text at least 24 px, and critical timer/result text at least 48 px.

The roles share tokens and component semantics, not identical layouts.

## Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| `color.ink` | `#242331` | Text, outlines, primary action |
| `color.paper` | `#FFFDF8` | Neutral surface |
| `color.sky` | `#BDEAFF` | Main game-board field |
| `color.blue` | `#86D8F7` | Player identity / secondary accent |
| `color.pink` | `#FF93BD` | Urgency, timer, lively accent |
| `color.mint` | `#87DEC1` | Success and player identity |
| `color.yellow` | `#FFE66F` | Selection and active prompt |
| `color.danger` | `#F35B65` | Incorrect, destructive, disconnected |
| `color.success-ink` | `#087A56` | Accessible success text and indicators |

Player colors are identity accents only. Every Player also has a visible nickname and stable marker such as an initial, number, or shape. Correctness, warnings, and connection state always pair color with an icon and text.

### Type

- `type.display`: Fredoka, weight 600-700, for game type, result, and room-scale headings.
- `type.ui`: Atkinson Hyperlegible, weight 400-700, for controls, scores, and status text.
- `type.label`: Atkinson Hyperlegible, weight 700, uppercase only for short labels.
- Scale: `12, 14, 16, 20, 24, 32, 48, 64, 80` px. Do not scale type with viewport width.

### Shape and space

- Spacing: `4, 8, 12, 16, 24, 32, 48, 64` px.
- Radius: `4` px for compact controls, `8` px for framed game surfaces, `999` px only for status chips.
- Borders: `2` px control, `3` px emphasized, `4` px room-display/media frame.
- Shadows: `4px 4px 0 color.ink` for controls and `7px 7px 0 color.ink` for major surfaces. No blurred decorative shadows.

### Motion

- Durations: `120ms` response, `180ms` transition, `280ms` reveal.
- Easing: `cubic-bezier(.2,.8,.2,1)`.
- Use motion for selection, result reveal, timer urgency, and state change only. Reduced motion removes translation/scale and substitutes immediate state changes or opacity under 120 ms.

## Components and states

Core components are `BrandMark`, `SessionCode`, `ConnectionStatus`, `RoundHeader`, `Countdown`, `MediaPrompt`, `Choice`, `PrimaryAction`, `PlayerMarker`, `PlayerList`, `ScoreRow`, `ResultBanner`, `StatusNotice`, and `ReconnectBanner`.

All interactive components require idle, hover where applicable, focus-visible, selected, disabled, and loading states. Choice-like components additionally require correct and incorrect states. Session surfaces require warning, disconnected, and reconnecting states.

- Focus: 4 px light ring with a 2 px ink outer edge; never remove the visible ring.
- Selected: yellow fill plus thicker border and check marker.
- Correct: mint fill plus check icon and text.
- Incorrect: danger tint plus cross icon and text; do not erase the submitted answer.
- Warning: pink field plus warning icon and direct next action.
- Disabled: reduced saturation, visible border, and explicit unavailable label where ambiguity is possible.
- Loading: preserve dimensions; use a text label and three-dot indicator, not an indefinite spinner alone.
- Disconnected: persistent danger banner that explains inputs are paused.
- Reconnecting: persistent yellow banner with live status; restore focus sensibly after reconnection.

Use semantic headings, native buttons, programmatic labels, polite live regions for non-critical updates, and assertive announcements only when input becomes unavailable. Meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and component boundaries.

## Screenshot acceptance criteria

- Host at 1440 x 900 shows game context, timer, connection state, primary action, media, choices, and leading scores without overlap or horizontal scrolling.
- Player at 390 x 844 shows the current instruction and all primary choices with at least 48 px targets; selection remains identifiable without color.
- Public Display at 1920 x 1080 shows the prompt, timer, current result, and leading scores without scrolling; critical text remains readable across a typical room.
- Shared components retain recognizable shape and state semantics across roles while density and hierarchy differ.
- Text does not overlap, truncate essential meaning, or cause layout shift when timers, loading labels, or Player names change.
- Reference images load and remain subordinate to controls and status overlays. Production assets must be owned or explicitly licensed; the remote Unsplash image is prototype-only.
- State-regression screenshots cover selected, correct, incorrect, warning, disabled, loading, disconnected, reconnecting, keyboard focus, and reduced motion.

## Storybook

Storybook is now warranted during production implementation because the component taxonomy and state matrix are stable enough to provide value. Add it when the first shared components are implemented, with role-width stories and interaction/accessibility checks. Do not carry prototype components into Storybook or treat Storybook as the source of product state.

## Running the prototype

Run `npm run dev` and open `/prototype/visual-identity?variant=A&role=host`. Variants are `A`, `B`, and `C`; roles are `host`, `player`, and `display`. Arrow keys cycle variants. The prototype is throwaway evidence and must not be merged into the production application.
