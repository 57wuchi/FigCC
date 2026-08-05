import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || process.env.FIGCLAW_WS_URL || 'ws://127.0.0.1:4319/ws');
let reviewStarted = false;
let reviewApproved = false;
let toolExecuted = false;
let finished = false;
const timeout = setTimeout(() => finish(new Error('Auto-review smoke test timed out.')), 240_000);

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
    console.log('Auto-review smoke test passed: the requested Figma mutation was reviewed, approved, and forwarded.');
  }
  socket.close();
}

socket.on('open', () => send({ type: 'authenticate', token }));
socket.on('message', (raw) => {
  const message = JSON.parse(String(raw));
  if (message.type === 'bridge.ready') {
    send({
      type: 'turn.start',
      requestId: 'review-smoke-turn',
      chatId: 'review-smoke-chat',
      threadId: null,
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
    });
    return;
  }
  if (message.type === 'review.started') {
    reviewStarted = true;
    return;
  }
  if (message.type === 'review.completed') {
    if (!message.approved) return finish(new Error(`Auto-review denied the explicit smoke action: ${message.reason || ''}`));
    reviewApproved = true;
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
    if (!reviewStarted) return finish(new Error('The bridge did not announce review.started.'));
    if (!reviewApproved) return finish(new Error('The bridge did not return an approved review.completed.'));
    if (!toolExecuted) return finish(new Error('The reviewed tool call was not forwarded.'));
    return finish(null);
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => finish(error));
