# Agent instructions

The canonical repository instructions are in [AGENTS.md](AGENTS.md). Read and follow that file before changing FigCC.

In particular: preserve the FigClaw MIT attribution, do not reintroduce a Claude API-key flow, do not weaken the local bridge or review boundaries, and run `npm run check` before handing off changes.

When a user asks for help after a pairing-token rejection, follow the secure recovery procedure in `AGENTS.md`. On macOS, after verifying that `.figcodex-data/bridge-token` exists, the Agent may copy it without printing it by running `/usr/bin/pbcopy < .figcodex-data/bridge-token`, then tell the user to paste it into **Local pairing token** and choose **Save & Connect**. Never echo, display, or log the token.
