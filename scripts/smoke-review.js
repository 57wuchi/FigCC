import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || process.env.FIGCLAW_WS_URL || 'ws://127.0.0.1:4319/ws');
let reviewEventReceived = false;
let toolExecuted = false;
let finished = false;
let workspacePath = '';
const timeout = setTimeout(() => finish(new Error('Canvas permission smoke test timed out.')), 240_000);

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
    console.log('Canvas permission smoke test passed: the Figma mutation was forwarded without auto-review.');
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
      requestId: 'canvas-permission-smoke-turn',
      chatId: 'canvas-permission-smoke-chat',
      threadId: null,
      workspacePath,
      prompt: 'I explicitly authorize one harmless Figma tool call now. Call run_figma_code exactly once with code `return { reviewed: true }`, then reply exactly: review checked',
      instructions: 'Use the provided run_figma_code tool exactly once. Do not use shell, filesystem, network, or any other tool.',
      tools: [{
        name: 'run_figma_code',
        description: 'Execute JavaScript in Figma. The user must explicitly authorize it.',
        input_schema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['code', 'description'],
        },
      }],
      images: [],
      model: '',
      permissionProfile: ':read-only',
    });
    return;
  }
  if (message.type === 'review.started') {
    reviewEventReceived = true;
    return;
  }
  if (message.type === 'review.completed') {
    reviewEventReceived = true;
    return;
  }
  if (message.type === 'tool.call') {
    if (message.tool !== 'run_figma_code') return finish(new Error(`Unexpected tool: ${message.tool}`));
    toolExecuted = true;
    send({
      type: 'tool.result',
      requestId: message.requestId,
      success: true,
      result: { reviewed: true },
    });
    return;
  }
  if (message.type === 'turn.completed') {
    if (message.status !== 'completed') return finish(new Error(`Turn ended with ${message.status}: ${message.error || ''}`));
    if (reviewEventReceived) return finish(new Error('The bridge unexpectedly auto-reviewed a Figma canvas tool.'));
    if (!toolExecuted) return finish(new Error('The direct canvas tool call was not forwarded.'));
    return finish(null);
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => finish(error));
