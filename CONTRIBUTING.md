# Contributing to FigCodex

## Local development

Requirements: Node.js 18+, Figma desktop, and a recent logged-in Codex CLI with App Server dynamic-tool support.

Read [AGENTS.md](AGENTS.md) before making changes. It defines the security, migration, documentation, and attribution invariants for this derivative project.

```bash
npm install
npm run dev
```

In another terminal:

```bash
npm run bridge
```

For normal daily use on macOS, `npm run bridge:install` installs the persistent user service. Use the terminal command above while developing so bridge logs stay visible.

Import `public/manifest.json` through **Figma → Plugins → Development → Import plugin from manifest…**. Paste the printed pairing token into the plugin's Settings tab.

Use `npm run check` before committing. For a real end-to-end check, keep the bridge running and execute `npm run bridge:smoke`.

## Project structure

```text
bridge/
  codex-app-server.js  JSON-RPC stdio client for codex app-server
  codex-discovery.js   compatible CLI discovery and login preflight
  server.js            loopback HTTP/WebSocket bridge and dynamic-tool router
scripts/               token, schema, and real smoke-test commands
src/
  UI.svelte            Svelte iframe, Codex events, tool-call routing, history
  code.ts              Figma sandbox, selection snapshots, storage, and tool execution
  tools.ts             JSON-schema dynamic-tool definitions
  system-prompt.md     Figma agent instructions
  components/          plugin UI
test/                  local unit and security-contract tests
public/
  manifest.json        Figma plugin manifest
  code.js              generated plugin sandbox bundle
  index.html           generated inlined UI bundle
```

`public/index.html`, `public/code.js`, and `public/build/bundle.js` are generated. Edit `src/` and rebuild instead of patching generated output.

## Runtime flow

1. The plugin authenticates to `bridge/server.js` with the local pairing token.
2. The bridge starts or resumes a Codex App Server thread.
3. `src/tools.ts` is registered as App Server `dynamicTools` when a thread starts.
4. Read-only `item/tool/call` requests are forwarded directly. Side-effecting calls first pass through `bridge/dynamic-tool-reviewer.js` and fail closed if review cannot approve them.
5. `src/code.ts` executes the approved Figma operation and returns structured data.
6. The bridge sends an App Server `contentItems` tool response and the same turn continues.

Canvas selection context is a separate read-only path: `src/code.ts` listens for Figma selection changes, sends bounded metadata and rendered previews to the UI, and `src/UI.svelte` snapshots that context only when the user presses Send. Do not silently upload selection previews on selection-change events.

Do not replace this with a plain `codex exec` subprocess per prompt: that pattern cannot reliably preserve the in-turn client tool handshake used by FigCodex.

## Adding a tool

1. Add its name, description, and JSON input schema to `src/tools.ts`.
2. Add its executor case to `src/code.ts`, unless it intentionally runs in the iframe like `fetch_docs`.
3. Document important behavior in `src/system-prompt.md`.
4. Add a test when the change affects the bridge or security boundary.

Keep tool names within `[A-Za-z][A-Za-z0-9_-]{0,63}`. Tool results must be JSON-serializable. Generated Figma code must use an explicit `return` when the agent needs a value back.

## Bridge constraints

- Keep loopback binding and pairing authentication as the defaults.
- Keep the Codex filesystem sandbox read-only, approval policy `on-request`, automatic reviewer enabled, and workspace root limited to this project.
- Keep the bridge-side review set and fail-closed behavior for Figma mutations, skill writes, and downloads. Dynamic tools are not covered by Codex's native filesystem approval flow.
- Keep compatible user-configured MCP servers disabled in the dedicated App Server process and preserve the tool-only runtime instructions.
- Do not add wildcard Figma network domains.
- Validate user-supplied fetch targets in the UI, not only in the manifest.
- Never send the pairing token to Codex or include it in prompts/logged events.
- Preserve thread IDs in chat history so conversation resume remains native.

The App Server dynamic-tool contract is experimental. When updating Codex compatibility, run:

```bash
npm run codex:schema
```

Inspect the generated `.codex-schema/` bindings, update the adapter narrowly, then run `npm run check`, `npm run bridge:smoke`, `npm run bridge:review-smoke`, and `npm run bridge:permissions-smoke`.

## Documentation and attribution

- Keep `README.md` and `README.zh-TW.md` aligned for user-visible behavior.
- Preserve the upstream FigClaw copyright in `LICENSE` and the derivative-work statement in `NOTICE.md`.
- Do not remove or obscure attribution to [PavelLaptev/FigClaw](https://github.com/PavelLaptev/FigClaw).
- Do not imply that FigCodex is an official Figma, Anthropic, or OpenAI product.
