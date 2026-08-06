# CLAUDE.md

Read and follow [AGENTS.md](AGENTS.md); it is the canonical repository instruction file.

## Claude-specific runtime note

FigCodex supports Claude through the official Claude Agent SDK and the user's existing local Claude Code login. It does not call Anthropic from the Figma iframe and does not ask users for a Claude API key. Do not restore the old direct-browser provider path, `sk-ant-...` settings, or Anthropic endpoints.

When working in this repository:

- use the dual-provider bridge architecture documented in `AGENTS.md` and `CONTRIBUTING.md`;
- preserve provider-isolated chats: Claude resumes only Claude session IDs and never imports Codex transcript text;
- keep `skills/` canonical through `.claude/skills` and `.agents/skills` symlinks;
- keep pairing authentication, the read-only sandbox, automatic review, and fail-closed dynamic-tool review intact;
- edit source files rather than generated files under `public/`;
- run `npm run check` and the relevant bridge smoke tests;
- keep `README.md` and `README.zh-TW.md` synchronized;
- preserve `LICENSE`, `NOTICE.md`, and attribution to [PavelLaptev/FigClaw](https://github.com/PavelLaptev/FigClaw).
