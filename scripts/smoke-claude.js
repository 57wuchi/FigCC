import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || 'ws://127.0.0.1:4319/ws');
let sessionId = '';
let phase = 1;
let answer = '';
let model = '';
let effort = '';
let finished = false;
const timeout = setTimeout(() => finish(new Error('Claude bridge smoke test timed out.')), 240_000);

function send(value) {
  socket.send(JSON.stringify(value));
}

function start(prompt, requestId) {
  send({
    type: 'turn.start',
    provider: 'claude',
    requestId,
    chatId: 'claude-smoke-chat',
    threadId: sessionId || null,
    prompt,
    instructions: 'You are a Figma agent. Follow the requested response exactly. Use only the provided FigCC tool when requested.',
    tools: [{
      name: 'get_selection',
      description: 'Return the current Figma selection.',
      input_schema: { type: 'object', properties: {}, required: [] },
    }],
    images: [],
    model,
    effort,
    permissionProfile: ':read-only',
  });
}

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    console.log('Claude bridge smoke test passed: MCP tool execution and native Claude session resume both work.');
  }
  socket.close();
}

socket.on('open', () => send({ type: 'authenticate', token }));
socket.on('message', (raw) => {
  const message = JSON.parse(String(raw));
  if (message.type === 'bridge.ready') {
    const claude = message.providers?.claude;
    if (!claude?.available) return finish(new Error(`Claude provider unavailable: ${claude?.error || ''}`));
    const selected = claude.models?.find((item) => item.isDefault) || claude.models?.[0];
    model = String(selected?.id || '');
    effort = String(selected?.supportedReasoningEfforts?.[0]?.id || '');
    start('Call get_selection exactly once. Then reply with exactly: claude selection checked', 'claude-smoke-turn');
    return;
  }
  if (message.type === 'turn.started' && message.threadId) sessionId = String(message.threadId);
  if (message.type === 'tool.call') {
    if (message.tool !== 'get_selection') return finish(new Error(`Unexpected Claude tool: ${message.tool}`));
    send({
      type: 'tool.result',
      requestId: message.requestId,
      success: true,
      result: { nodes: [], message: 'Nothing is selected.' },
    });
    return;
  }
  if (message.type === 'agent.completed' && message.text) answer += String(message.text);
  if (message.type === 'turn.completed') {
    if (message.status !== 'completed') {
      return finish(new Error(`Claude turn ended with ${message.status}: ${message.error || ''}`));
    }
    if (phase === 1) {
      if (!/claude selection checked/i.test(answer)) return finish(new Error(`Unexpected Claude answer: ${answer}`));
      if (!sessionId) return finish(new Error('Bridge did not return a Claude session id.'));
      phase = 2;
      answer = '';
      start('Without calling a tool, reply with exactly: claude session resumed', 'claude-smoke-resume');
      return;
    }
    finish(/claude session resumed/i.test(answer)
      ? null
      : new Error(`Unexpected resumed Claude answer: ${answer}`));
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => finish(error));
