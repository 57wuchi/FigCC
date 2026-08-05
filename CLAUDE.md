# CLAUDE.md

Read and follow [AGENTS.md](AGENTS.md); it is the canonical repository instruction file.

## Claude-specific compatibility note

FigCodex is derived from FigClaw, but the production runtime no longer calls the Anthropic API and does not ask users for a Claude API key. Do not restore the old provider path, `sk-ant-...` settings, Anthropic endpoints, or Claude model names unless the user explicitly requests a separate provider architecture and its security/storage design is reviewed.

When working in this repository:

- use the Codex App Server bridge architecture documented in `AGENTS.md` and `CONTRIBUTING.md`;
- keep pairing authentication, the read-only sandbox, automatic review, and fail-closed dynamic-tool review intact;
- edit source files rather than generated files under `public/`;
- run `npm run check` and the relevant bridge smoke tests;
- keep `README.md` and `README.zh-TW.md` synchronized;
- preserve `LICENSE`, `NOTICE.md`, and attribution to [PavelLaptev/FigClaw](https://github.com/PavelLaptev/FigClaw).
