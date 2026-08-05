# AGENTS.md

This file contains repository-wide instructions for coding agents working on FigCodex.

## Project identity

- Product name: **FigCodex**.
- Package/service identifiers: `figcodex`, `FIGCODEX_*`, and `com.figcodex.bridge`.
- FigCodex is a derivative of [PavelLaptev/FigClaw](https://github.com/PavelLaptev/FigClaw), used under the MIT License.
- Preserve [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), the upstream copyright line, and the explicit FigClaw attribution in both READMEs.
- This is an independent community project. Do not imply official affiliation with Figma, Anthropic, or OpenAI.

## Runtime architecture

```text
Figma iframe UI → authenticated loopback WebSocket bridge → codex app-server
       ↑ dynamic tool calls and results ↓
Figma plugin sandbox → open Figma document
```

- `src/UI.svelte` owns the iframe, WebSocket client, conversation state, streamed Codex events, and tool-call routing.
- `src/code.ts` owns Figma APIs, client storage, selection snapshots, downloads, and tool execution.
- `bridge/server.js` owns pairing authentication, Codex threads/turns, model discovery, attachments, and dynamic-tool routing.
- `bridge/codex-app-server.js` is the JSON-RPC stdio adapter.
- `bridge/dynamic-tool-reviewer.js` performs the independent fail-closed review for side-effecting FigCodex tools.
- `src/tools.ts` is the dynamic-tool schema source of truth.
- Do not replace the App Server flow with one `codex exec` subprocess per prompt; that breaks the in-turn client tool handshake and native thread resume.

## Security invariants

Do not weaken these without an explicit, security-reviewed request:

- The bridge binds to loopback by default and requires the pairing token.
- Pairing tokens, Codex credentials, `.figcodex-data/`, and `.figclaw-data/` must never enter git, prompts, UI diagnostics, or public logs.
- Codex defaults to the live `:read-only` permission profile with `approvalPolicy: on-request`, `approvalsReviewer: auto_review`, and this project as its narrow runtime root. Workspace and full-access profiles remain explicit user choices.
- Figma canvas inspection and mutations run directly through the plugin sandbox. Skill writes, downloads, and local project-file escalations retain their applicable review boundary.
- Bridge-side review for actions that still require it fails closed. A parse error, timeout, unavailable reviewer, or uncertain decision is not approval.
- Keep compatible user-configured MCP servers disabled for the dedicated canvas agent unless a deliberate architecture change is approved and tested.
- Keep the Figma manifest allowlist narrow. Never add wildcard network domains.
- Validate fetch targets in code in addition to the manifest.
- Selection metadata and previews stay local until the user presses Send.
- Bound node counts, text lengths, image counts, image sizes, and serialized tool results.

## Compatibility and storage

- New names use FigCodex identifiers.
- Legacy FigClaw storage keys, `.figclaw-data`, pairing tokens, and environment variables are read only as migration fallbacks.
- Do not remove a migration fallback without documenting the breaking change.
- Preserve Codex thread IDs and the current thread policy version when changing chat history.
- Model, reasoning-effort, and permission-profile choices must come from the live App Server catalogs; do not hard-code a marketing model or permissions list.

## Pairing-token assistance

- When the plugin reports that the pairing token was rejected, first run `npm run bridge:status` and verify that `.figcodex-data/bridge-token` exists and is non-empty. Compare migration tokens only with a boolean check such as `cmp -s`; never print either value.
- If the user asks the Agent to obtain or enter the current token, do not run a command whose captured output contains the secret. On macOS, copy it directly to the system clipboard with `/usr/bin/pbcopy < .figcodex-data/bridge-token`.
- After copying, tell the user to replace the complete **Local pairing token** field and choose **Save & Connect**. Reconnect alone does not persist a replacement token.
- Never echo, `cat`, quote, paste into chat, include in diagnostics, or otherwise expose the pairing token. If the token file is missing, start or restart the bridge first, then repeat the non-printing existence check.

## UI and brand

- Follow [DESIGN.md](DESIGN.md).
- The source brand asset is `src/assets/figcodex-logo.png`; the repository-facing copy is `icon.png`.
- The header and empty-chat state use the same asset. Do not embed another hand-drawn replacement glyph.
- Keep the 400 px Figma panel usable: menus must remain inside the viewport and important controls must stay keyboard accessible.
- User-facing prose uses the native UI font. Monospace is reserved for code and technical values.
- Do not edit generated `public/index.html`, `public/code.js`, or `public/build/bundle.js` by hand.

## Development workflow

```bash
npm install
npm run check
```

For runtime changes, also run the relevant real smoke tests with a bridge already running:

```bash
npm run bridge:smoke
npm run bridge:review-smoke
npm run bridge:permissions-smoke
npm run bridge:selection-smoke
```

When the experimental Codex App Server contract changes:

```bash
npm run codex:schema
```

Inspect `.codex-schema/`, update the adapter narrowly, then rerun build, tests, and smoke tests. Do not commit `.codex-schema/`.

## Change checklist

1. Inspect the smallest relevant source files before editing.
2. Preserve unrelated user changes and migration data.
3. Add or update a contract test for bridge, permission, storage, manifest, selection, model, or packaging changes.
4. Run `npm run check`.
5. Run relevant real bridge smoke tests for protocol or permission changes.
6. Update both `README.md` and `README.zh-TW.md` when user-visible behavior changes.
7. Keep `NOTICE.md` and upstream attribution intact.

## Files intended for publication

- Include source, tests, documentation, `LICENSE`, `NOTICE.md`, `icon.png`, and the attribution assets.
- Exclude dependencies, pairing data, tokens, logs, generated schemas, OS files, and local editor state.
- Before publishing, inspect `git status`, stage explicit files, run tests, and verify no secret-bearing data is tracked.
