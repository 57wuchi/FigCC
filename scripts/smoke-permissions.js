import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const outputPath = path.join(root, '.figcodex-data', 'auto-review-filesystem-smoke.txt');
const marker = `figcodex-auto-review-${Date.now()}`;
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || process.env.FIGCLAW_WS_URL || 'ws://127.0.0.1:4319/ws');
let finished = false;
let workspacePath = '';
const timeout = setTimeout(() => finish(new Error('Filesystem permission smoke test timed out.')), 240_000);

function send(message) {
  socket.send(JSON.stringify(message));
}

async function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (!error) {
    const content = await readFile(outputPath, 'utf8').catch(() => '');
    if (content.trim() !== marker) {
      error = new Error('The auto-reviewed filesystem write did not create the expected marker.');
    }
  }
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    console.log('Filesystem permission smoke test passed: Codex auto-review approved a scoped project write.');
  }
  socket.close();
}

socket.on('open', () => send({ type: 'authenticate', token }));
socket.on('message', (raw) => {
  const message = JSON.parse(String(raw));
  if (message.type === 'bridge.ready') {
    workspacePath = String(message.workspace?.path || '');
    send({
      type: 'turn.start',
      requestId: 'filesystem-smoke-turn',
      chatId: 'filesystem-smoke-chat',
      threadId: null,
      workspacePath,
      prompt: `I explicitly authorize you to create or overwrite only .figcodex-data/auto-review-filesystem-smoke.txt inside this FigCC project. Write exactly this one line: ${marker}`,
      instructions: 'This is an explicit project-file request. Use Codex filesystem or shell tooling only inside the FigCC project root, make exactly the requested one-file change, and do not call the provided Figma tool or use network/subagents. The write is expected to require automatic permission review.',
      tools: [{
        name: 'get_selection',
        description: 'Unused read-only Figma tool. Do not call it for this filesystem smoke test.',
        input_schema: { type: 'object', properties: {}, required: [] },
      }],
      images: [],
      model: '',
      permissionProfile: ':read-only',
    });
    return;
  }
  if (message.type === 'tool.call') {
    return void finish(new Error(`Unexpected Figma tool call: ${message.tool}`));
  }
  if (message.type === 'turn.completed') {
    if (message.status !== 'completed') {
      return void finish(new Error(`Turn ended with ${message.status}: ${message.error || ''}`));
    }
    return void finish(null);
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    return void finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => void finish(error));
