import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || process.env.FIGCLAW_WS_URL || 'ws://127.0.0.1:4319/ws');
const messages = [];
let finished = false;
let workspacePath = '';
const timeout = setTimeout(() => finish(new Error('Selection context smoke test timed out.')), 180_000);
const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

function send(message) {
  socket.send(JSON.stringify(message));
}

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    console.log('Selection context smoke test passed: metadata and a localImage reached Codex in one turn.');
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
      requestId: 'selection-context-smoke-turn',
      chatId: 'selection-context-smoke-chat',
      threadId: null,
      workspacePath,
      prompt: '<figma_selection_context>{"selectedNodeCount":1,"nodes":[{"id":"1:2","name":"Smoke image","type":"RECTANGLE","visualPreviewAttached":true}]}</figma_selection_context>\nReply with exactly: selection context received',
      instructions: 'The user supplied a Figma selection snapshot and image preview. Do not call tools. Reply with exactly: selection context received',
      tools: [{
        name: 'get_selection',
        description: 'Unused read-only Figma tool.',
        input_schema: { type: 'object', properties: {}, required: [] },
      }],
      images: [{ dataUrl: onePixelPng, mediaType: 'image/png' }],
      model: '',
    });
    return;
  }
  if (message.type === 'tool.call') {
    return finish(new Error(`Unexpected tool call: ${message.tool}`));
  }
  if (message.type === 'agent.completed' && message.text) messages.push(String(message.text));
  if (message.type === 'turn.completed') {
    if (message.status !== 'completed') {
      return finish(new Error(`Turn ended with ${message.status}: ${message.error || ''}`));
    }
    const answer = messages.join('\n');
    return finish(/selection context received/i.test(answer)
      ? null
      : new Error(`Unexpected selection-context answer: ${answer}`));
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => finish(error));
