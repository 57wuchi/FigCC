# Attribution notice

FigCodex is a derivative work based on [FigClaw](https://github.com/PavelLaptev/FigClaw), originally created by Pavel Laptev and released under the MIT License.

The original copyright notice is preserved in [LICENSE](LICENSE):

> Copyright (c) 2025 Pavel Laptev

FigCodex retains the original project's MIT terms and adds substantial changes, including:

- replacement of the Claude API integration with a local Codex CLI App Server bridge;
- pairing-token authentication and loopback-only WebSocket transport;
- automatic review for side-effecting Figma tools and Codex filesystem escalations;
- live Codex model and reasoning-effort selection;
- Figma selection metadata, text context, and rendered visual previews in the composer;
- persistent Codex threads, cross-file chat history, and migration from legacy FigClaw storage;
- a macOS LaunchAgent installer for a persistent local bridge;
- a redesigned FigCodex interface, visual system, and purple glass brand mark;
- additional tests, security contracts, documentation, and Traditional Chinese documentation.

The files under `docs/attribution/` preserve original FigClaw promotional assets for attribution and historical reference. They remain covered by the upstream project's MIT License.

FigCodex is an independent community project. It is not affiliated with, endorsed by, or sponsored by Pavel Laptev, Figma, Anthropic, OpenAI, or their respective affiliates. Figma, Claude, OpenAI, ChatGPT, and Codex are trademarks of their respective owners.
