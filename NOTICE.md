# Attribution notice

FigCC, formerly FigCodex, is a derivative work based on [FigClaw](https://github.com/PavelLaptev/FigClaw), originally created by Pavel Laptev and released under the MIT License.

The original copyright notice is preserved in [LICENSE](LICENSE):

> Copyright (c) 2025 Pavel Laptev

FigCC retains the original project's MIT terms and adds substantial changes, including:

- replacement of the direct Claude API integration with an authenticated local bridge for Codex CLI App Server and the Claude Code Agent SDK;
- pairing-token authentication and loopback-only WebSocket transport;
- automatic review for side-effecting Figma tools and Codex filesystem escalations;
- live provider-specific model, reasoning-effort, and permission selection;
- Figma selection metadata, text context, and rendered visual previews in the composer;
- provider-isolated Codex threads and Claude sessions, cross-file chat history, and migration from legacy FigClaw storage;
- canonical skill packages shared through `.agents/skills` and `.claude/skills` symlinks;
- a macOS LaunchAgent installer for a persistent local bridge;
- a redesigned FigCC interface, dual-provider visual system, and four-circle brand mark;
- additional tests, security contracts, documentation, and Traditional Chinese documentation.

The files under `docs/attribution/` preserve original FigClaw promotional assets for attribution and historical reference. They remain covered by the upstream project's MIT License.

FigCC is an independent community project. It is not affiliated with, endorsed by, or sponsored by Pavel Laptev, Figma, Anthropic, OpenAI, or their respective affiliates. Figma, Claude, OpenAI, ChatGPT, and Codex are trademarks of their respective owners.
