import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = (await readFile(path.join(root, '.figcodex-data', 'bridge-token'), 'utf8').catch(() => '')
  || await readFile(path.join(root, '.figclaw-data', 'bridge-token'), 'utf8')).trim();
const socket = new WebSocket(process.env.FIGCODEX_WS_URL || process.env.FIGCLAW_WS_URL || 'ws://127.0.0.1:4319/ws');
const messages = [];
let threadId = null;
let phase = 1;
let finished = false;
let smokeModel = '';
let smokeEffort = '';
let workspacePath = '';
const timeout = setTimeout(() => finish(new Error('Bridge smoke test timed out.')), 180_000);

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
    console.log('Bridge smoke test passed: dynamic tool execution and Codex thread resume both work.');
  }
  socket.close();
}

socket.on('open', () => send({ type: 'authenticate', token }));
socket.on('message', (raw) => {
  const message = JSON.parse(String(raw));
  if (message.type === 'bridge.ready') {
    workspacePath = String(message.workspace?.path || '');
    const availableModels = Array.isArray(message.models) ? message.models : [];
    const selectedModel = availableModels.find((item) => item.isDefault) || availableModels[0];
    smokeModel = String(selectedModel?.id || '');
    const efforts = Array.isArray(selectedModel?.supportedReasoningEfforts)
      ? selectedModel.supportedReasoningEfforts
      : [];
    smokeEffort = String(
      efforts.find((item) => item.id === selectedModel?.defaultReasoningEffort)?.id
      || efforts.find((item) => item.id === 'medium')?.id
      || efforts[0]?.id
      || ''
    );
    send({
      type: 'turn.start',
      requestId: 'smoke-turn',
      chatId: 'smoke-chat',
      threadId: null,
      workspacePath,
      prompt: 'Call get_selection exactly once. After the tool result, reply with exactly: selection checked',
      instructions: 'You are a Figma agent. Use the provided dynamic tool. Do not use shell or any other tool.',
      tools: [{
        name: 'get_selection',
        description: 'Return the current Figma selection.',
        input_schema: { type: 'object', properties: {}, required: [] },
      }],
      images: [],
      model: smokeModel,
      effort: smokeEffort,
    });
    return;
  }
  if (message.type === 'tool.call') {
    if (message.tool !== 'get_selection') return finish(new Error(`Unexpected tool: ${message.tool}`));
    send({
      type: 'tool.result',
      requestId: message.requestId,
      success: true,
      result: { nodes: [], message: 'Nothing is selected.' },
    });
    return;
  }
  if (message.type === 'turn.accepted' && message.threadId) threadId = String(message.threadId);
  if (message.type === 'agent.completed' && message.text) messages.push(message.text);
  if (message.type === 'turn.completed') {
    if (message.status !== 'completed') return finish(new Error(`Turn ended with ${message.status}: ${message.error || ''}`));
    const answer = messages.join('\n');
    if (phase === 1) {
      if (!/selection checked/i.test(answer)) return finish(new Error(`Unexpected first answer: ${answer}`));
      if (!threadId) return finish(new Error('Bridge did not return a Codex thread id.'));
      phase = 2;
      messages.length = 0;
      send({
        type: 'turn.start',
        requestId: 'smoke-resume',
        chatId: 'smoke-chat',
        threadId,
        workspacePath,
        prompt: 'Without calling a tool, reply with exactly: thread resumed',
        instructions: 'You are a Figma agent. Use only provided dynamic tools when needed. Do not use shell or any other tool.',
        tools: [{
          name: 'get_selection',
          description: 'Return the current Figma selection.',
          input_schema: { type: 'object', properties: {}, required: [] },
        }],
        images: [],
        model: smokeModel,
        effort: smokeEffort,
      });
      return;
    }
    return finish(/thread resumed/i.test(answer) ? null : new Error(`Unexpected resumed answer: ${answer}`));
  }
  if (message.type === 'auth.error' || message.type === 'bridge.error') {
    finish(new Error(String(message.error || message.type)));
  }
});
socket.on('error', (error) => finish(error));
