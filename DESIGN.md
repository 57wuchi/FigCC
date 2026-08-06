# FigCodex design system

FigCodex uses a compact, Codex-inspired interface for working with a Figma canvas. This is a project-specific design contract, not an official OpenAI or Codex design-system export.

## Source of truth

OpenAI does not currently publish a Codex App `DESIGN.md`. The public Codex guidance recommends keeping repeated visual decisions in a project-level design file, while the OpenAI Apps SDK publishes reusable UI tokens and components for ChatGPT-connected apps. FigCodex therefore combines:

- the visible interaction character of the Codex desktop app: neutral surfaces, restrained controls, clear status, and tool-first density;
- the OpenAI Apps SDK guidance on accessible tokens, focus states, and reusable components;
- Figma plugin constraints: a 400 px panel, short scan paths, and no decorative UI that competes with the canvas.

References:

- https://academy.openai.com/en/public/clubs/champions-ecqup/videos/design-context-and-iteration-with-codex-2026-07-09
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://www.figma.com/community/file/1625636989296445101

## Product identity

- Product name: **FigCodex**.
- Positioning: local Codex or Claude Code, directly beside the Figma canvas.
- Voice: concise, capable, calm. Prefer direct labels such as “Connected”, “New chat”, and “Send”.
- The brand mark is the purple glass FigCodex symbol in `icon.png`. Use the full-color mark on dark or neutral surfaces; do not redraw it as a code-frame glyph.
- At very small sizes, preserve the mark's four-part silhouette and dark rounded-square tile instead of adding outlines or text.
- Green is a status signal, not a decorative brand color.

## Principles

1. **Canvas first.** The plugin is an instrument, not a landing page. Keep the current task and composer visually dominant.
2. **Monochrome by default.** Use color only to communicate selection, success, warning, or failure.
3. **One elevation step at a time.** Separate layers with subtle surface changes and 1 px borders; avoid glows, gradients, and heavy shadows.
4. **Compact, not cramped.** Use a 4 px base grid with 12–16 px panel spacing and minimum 28 px controls.
5. **State must be legible.** Connection, review, running, selected, disabled, and error states must never depend on color alone.
6. **Motion confirms change.** Keep transitions between 120–180 ms and respect `prefers-reduced-motion`.

## Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#0f0f0f` | App background |
| Surface 1 | `#171717` | Composer, cards, active areas |
| Surface 2 | `#202020` | Hover and nested controls |
| Surface 3 | `#2a2a2a` | Strong selected state |
| Text primary | `#f5f5f5` | Main labels and content |
| Text secondary | `#a3a3a3` | Supporting copy |
| Text tertiary | `#737373` | Metadata and placeholders |
| Border | `#2d2d2d` | Default separators |
| Border strong | `#454545` | Focused and selected controls |
| Action | `#f2f2f2` | Primary action background |
| Selection | `#8e9fff` | Figma selection context only |
| Success | `#4ade80` | Connected, approved, completed |
| Warning | `#fbbf24` | Missing or attention required |
| Danger | `#f87171` | Denied, failed, destructive |

### Type

- UI: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- Code/data: `SFMono-Regular`, `Menlo`, `Monaco`, monospace.
- Body: 13 px / 1.5.
- Supporting: 11–12 px / 1.45.
- Product name: 14 px / 600.
- Do not load remote fonts; the native stack is faster and visually consistent with desktop Codex.

### Geometry

- Radius: 4 px for compact controls, 6 px for cards, 8 px for major containers.
- Do not use pill containers except status badges or numeric counts.
- Borders: 1 px. Shadows are reserved for floating menus.
- Panel inset: 14 px. Component gaps: 4, 8, 12, or 16 px.

## Components

### Header and navigation

- The FigCodex wordmark must be visible in the top row.
- A compact Codex/Claude segmented switch sits to the right of the wordmark. Switching starts a new empty chat and never transfers context.
- Tabs use a quiet underline/filled state, not a floating capsule.
- “New chat” is a familiar plus icon with an accessible label and tooltip.

### Composer

- The composer is the strongest surface in Chat.
- Primary Send uses a light button with dark text.
- The controls beside Send show the active provider's model, effective reasoning effort, and filesystem permission profile. Options come from the live provider catalog, and unsupported choices are never shown.
- Figma selection uses the selection token and includes node name, type, dimensions, and preview/text where useful.
- Uploaded references and live Figma selection remain visually distinct.
- The image control is followed by a paperclip control for bounded document and source-file attachments. Attached files show filename, size, removal, error, and keyboard-focus states before Send.

### Messages and tool calls

- Assistant content sits directly on the canvas or a quiet neutral surface.
- User messages use a stronger neutral surface and align right; do not tint them with a brand color.
- Running tools show motion plus a text label. Completed and failed states include an icon and semantic color.

### Settings and permissions

- Pairing token is described as a local secret, never as an API key.
- Connection state appears beside the bridge label and in text.
- Codex CLI and Claude Code readiness are shown independently; one unavailable provider does not hide a ready provider.
- Figma canvas edits execute directly and are visually distinct from filesystem permissions.
- The default filesystem profile is Read only. Workspace and Full access must remain explicit user choices, and Full access uses warning text in addition to color.
- Auto review applies to local-file escalation and other local side effects. It must not be described as bypassing permissions.

## Accessibility and quality bar

- Every icon-only control has an accessible name and tooltip.
- All interactive elements expose a visible `:focus-visible` ring.
- Dynamic connection, selection, and task status use `aria-live` where appropriate.
- Text contrast targets WCAG AA or better.
- Hover must not shift layout; reduced-motion users receive no transforms or looping decorative animation.
- Verify the production build, unit tests, bridge connection, reconnect action, Send, stop, selection dismissal, keyboard tab order, and 400 px layout before release.

## Naming compatibility

New visible product copy, package metadata, bridge service labels, and new environment variables use `FigCodex` / `figcodex` / `FIGCODEX_*`. Legacy `figclaw_*` Figma storage keys and `.figclaw-data` may be read during migration so existing settings, history, and pairing tokens are not lost.
