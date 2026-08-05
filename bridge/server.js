import crypto from 'node:crypto';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { CodexAppServer } from './codex-app-server.js';
import { discoverCodex, readLoginStatus } from './codex-discovery.js';
import { needsDynamicToolReview, reviewDynamicTool } from './dynamic-tool-reviewer.js';
import {
  normalizePermissionProfiles,
  resolvePermissionProfile,
} from './permission-profiles.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(ROOT, '.figcodex-data');
const LEGACY_DATA_DIR = path.join(ROOT, '.figclaw-data');
const TOKEN_FILE = path.join(DATA_DIR, 'bridge-token');
const LEGACY_TOKEN_FILE = path.join(LEGACY_DATA_DIR, 'bridge-token');
const HOST = process.env.FIGCODEX_HOST || process.env.FIGCLAW_HOST || '127.0.0.1';
const PORT = Number(process.env.FIGCODEX_PORT || process.env.FIGCLAW_PORT || 4319);
const MAX_MESSAGE_BYTES = 40 * 1024 * 1024;
const BRIDGE_VERSION = '2.0.0';

let codexInfo = null;
let loginStatus = null;
let codex = null;
let startupError = null;
let models = [];
let permissionProfiles = normalizePermissionProfiles(null);
let permissionProfilesSupported = false;
let startupPromise = null;

const threadOwners = new Map();
const activeTurns = new Map();
const turnContexts = new Map();
const threadPromptContexts = new Map();
const pendingToolCalls = new Map();
const sockets = new Set();

async function ensureToken() {
  if (process.env.FIGCODEX_BRIDGE_TOKEN) return process.env.FIGCODEX_BRIDGE_TOKEN;
  if (process.env.FIGCLAW_BRIDGE_TOKEN) return process.env.FIGCLAW_BRIDGE_TOKEN;
  await mkdir(DATA_DIR, { recursive: true });
  const existing = await readFile(TOKEN_FILE, 'utf8').catch(() => '');
  if (existing.trim()) return existing.trim();
  const legacy = await readFile(LEGACY_TOKEN_FILE, 'utf8').catch(() => '');
  if (legacy.trim()) {
    await writeFile(TOKEN_FILE, `${legacy.trim()}\n`, { mode: 0o600 });
    return legacy.trim();
  }
  const token = crypto.randomBytes(24).toString('base64url');
  await writeFile(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  return token;
}

function sameToken(left, right) {
  const a = crypto.createHash('sha256').update(String(left || '')).digest();
  const b = crypto.createHash('sha256').update(String(right || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

function send(socket, value) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function publicError(error) {
  return error instanceof Error ? error.message : String(error);
}

function attachCodexEvents(instance) {
  instance.on('diagnostic', (message) => {
    if (message) console.error(`[codex] ${message}`);
  });
  instance.on('closed', (error) => {
    startupError = publicError(error);
    codex = null;
    for (const socket of sockets) send(socket, { type: 'bridge.error', error: startupError });
  });
  instance.on('notification', ({ method, params }) => {
    const socket = params?.threadId ? threadOwners.get(params.threadId) : null;
    if (!socket) return;

    if (method === 'turn/started') {
      const turnId = params.turn?.id;
      if (turnId) activeTurns.set(params.threadId, turnId);
      send(socket, { type: 'turn.started', threadId: params.threadId, turnId });
      return;
    }
    if (method === 'item/agentMessage/delta') {
      send(socket, {
        type: 'agent.delta',
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.itemId,
        delta: params.delta,
      });
      return;
    }
    if (method === 'item/completed') {
      const item = params.item || {};
      if (item.type === 'agentMessage') {
        send(socket, {
          type: 'agent.completed',
          threadId: params.threadId,
          turnId: params.turnId,
          itemId: item.id,
          text: item.text || '',
          phase: item.phase || null,
        });
      } else if (item.type === 'dynamicToolCall') {
        send(socket, {
          type: 'tool.completed',
          threadId: params.threadId,
          turnId: params.turnId,
          callId: item.id,
          tool: item.tool,
          success: item.success,
        });
      }
      return;
    }
    if (method === 'turn/completed') {
      activeTurns.delete(params.threadId);
      if (params.turn?.id) turnContexts.delete(params.turn.id);
      threadPromptContexts.delete(params.threadId);
      send(socket, {
        type: 'turn.completed',
        threadId: params.threadId,
        turnId: params.turn?.id,
        status: params.turn?.status,
        error: params.turn?.error?.message || params.turn?.error || null,
      });
      return;
    }
    if (method === 'error') {
      send(socket, {
        type: 'turn.error',
        threadId: params.threadId,
        turnId: params.turnId,
        error: params.error?.message || 'Codex turn failed.',
        willRetry: Boolean(params.willRetry),
      });
    }
  });

  instance.on('request', (request) => {
    void handleCodexRequest(instance, request).catch((error) => {
      instance.respond(request.id, {
        contentItems: [{ type: 'inputText', text: `FigCodex bridge error: ${publicError(error)}` }],
        success: false,
      });
    });
  });
}

async function handleCodexRequest(instance, request) {
  if (request.method !== 'item/tool/call') {
    instance.respondError(request.id, `FigCodex does not support server request: ${request.method}`);
    return;
  }

  const params = request.params || {};
  const socket = threadOwners.get(params.threadId);
  if (!socket) {
    instance.respond(request.id, {
      contentItems: [{ type: 'inputText', text: 'FigCodex plugin is disconnected.' }],
      success: false,
    });
    return;
  }

  let review = null;
  if (needsDynamicToolReview(params.tool)) {
    const requestId = String(request.id);
    send(socket, {
      type: 'review.started',
      requestId,
      threadId: params.threadId,
      turnId: params.turnId,
      tool: params.tool,
    });
    review = await reviewDynamicTool({
      codex: instance,
      root: ROOT,
      userPrompt: turnContexts.get(params.turnId) || threadPromptContexts.get(params.threadId) || '',
      tool: params.tool,
      arguments: params.arguments || {},
    });

    if (threadOwners.get(params.threadId) !== socket || socket.readyState !== WebSocket.OPEN) {
      instance.respond(request.id, {
        contentItems: [{ type: 'inputText', text: 'FigCodex plugin disconnected during auto-review.' }],
        success: false,
      });
      return;
    }

    send(socket, {
      type: 'review.completed',
      requestId,
      threadId: params.threadId,
      turnId: params.turnId,
      tool: params.tool,
      approved: review.approved,
      risk: review.risk,
      reason: review.reason,
    });
    if (!review.approved) {
      instance.respond(request.id, {
        contentItems: [{
          type: 'inputText',
          text: `FigCodex auto-review denied ${params.tool}: ${review.reason}`,
        }],
        success: false,
      });
      return;
    }
  }

  pendingToolCalls.set(String(request.id), { requestId: request.id, socket });
  send(socket, {
    type: 'tool.call',
    requestId: String(request.id),
    threadId: params.threadId,
    turnId: params.turnId,
    callId: params.callId,
    namespace: params.namespace,
    tool: params.tool,
    arguments: params.arguments || {},
    ...(review ? { review } : {}),
  });
}

async function ensureCodex() {
  if (codex?.started) return codex;
  if (startupPromise) return startupPromise;
  startupPromise = (async () => {
    startupError = null;
    codexInfo = await discoverCodex();
    loginStatus = await readLoginStatus(codexInfo.binary);
    if (!loginStatus.ok) {
      throw new Error(`Codex CLI 尚未登入：${loginStatus.message || '請先執行 codex login。'}`);
    }
    const instance = new CodexAppServer({ binary: codexInfo.binary, cwd: ROOT });
    attachCodexEvents(instance);
    await instance.start();
    const modelResult = await instance.request('model/list', { limit: 100 }).catch(() => ({ data: [] }));
    models = (modelResult?.data || []).filter((model) => !model.hidden).map((model) => ({
      id: String(model.model || model.id || ''),
      label: String(model.displayName || model.model || model.id || ''),
      isDefault: Boolean(model.isDefault),
      supportedReasoningEfforts: (Array.isArray(model.supportedReasoningEfforts)
        ? model.supportedReasoningEfforts
        : [])
        .map((option) => ({
          id: String(option?.reasoningEffort || option?.effort || option || '').trim(),
          description: String(option?.description || '').slice(0, 500),
        }))
        .filter((option) => option.id),
      defaultReasoningEffort: String(model.defaultReasoningEffort || '').trim(),
    })).filter((model) => model.id);
    try {
      const permissionResult = await instance.request('permissionProfile/list', {
        cwd: ROOT,
        limit: 100,
      });
      permissionProfiles = normalizePermissionProfiles(permissionResult);
      permissionProfilesSupported = Array.isArray(permissionResult?.data)
        && permissionResult.data.some((profile) => (
          String(profile?.id || '').trim()
          && profile?.allowed !== false
        ));
    } catch {
      permissionProfiles = normalizePermissionProfiles(null);
      permissionProfilesSupported = false;
    }
    codex = instance;
    return codex;
  })();

  try {
    return await startupPromise;
  } catch (error) {
    startupError = publicError(error);
    throw error;
  } finally {
    startupPromise = null;
  }
}

function normalizeTools(rawTools) {
  if (!Array.isArray(rawTools) || rawTools.length === 0) throw new Error('FigCodex tools are missing.');
  return rawTools.slice(0, 32).map((tool) => {
    const name = String(tool?.name || '');
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error(`Invalid tool name: ${name}`);
    return {
      type: 'function',
      name,
      description: String(tool.description || '').slice(0, 8_000),
      inputSchema: tool.input_schema && typeof tool.input_schema === 'object'
        ? tool.input_schema
        : { type: 'object', properties: {} },
    };
  });
}

async function saveImages(chatId, images) {
  const safeChatId = String(chatId || 'chat').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'chat';
  const directory = path.join(DATA_DIR, 'attachments', safeChatId);
  await mkdir(directory, { recursive: true });
  const paths = [];
  for (const image of Array.isArray(images) ? images.slice(0, 5) : []) {
    const match = String(image?.dataUrl || '').match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);
    if (!match) continue;
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > 12 * 1024 * 1024) continue;
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filePath = path.join(directory, `${crypto.randomUUID()}.${extension}`);
    await writeFile(filePath, bytes);
    paths.push(filePath);
  }
  return paths;
}

async function startTurn(socket, message) {
  const instance = await ensureCodex();
  const developerInstructions = String(message.instructions || '').slice(0, 160_000);
  const requestedModel = String(message.model || '').trim();
  const selectedModel = models.find((item) => item.id === requestedModel);
  const model = selectedModel?.id;
  const requestedEffort = String(message.effort || '').trim();
  const effort = selectedModel?.supportedReasoningEfforts
    .some((item) => item.id === requestedEffort)
    ? requestedEffort
    : undefined;
  const permissionProfile = resolvePermissionProfile(permissionProfiles, message.permissionProfile);
  const permissionSettings = permissionProfilesSupported
    ? { permissions: permissionProfile }
    : { sandbox: 'read-only' };
  let threadId = String(message.threadId || '').trim();
  let resumed = false;

  if (threadId) {
    try {
      await instance.request('thread/resume', {
        threadId,
        cwd: ROOT,
        runtimeWorkspaceRoots: [ROOT],
        approvalPolicy: 'on-request',
        approvalsReviewer: 'auto_review',
        ...permissionSettings,
        developerInstructions,
        ...(model ? { model } : {}),
      });
      resumed = true;
    } catch {
      threadId = '';
    }
  }

  if (!threadId) {
    const started = await instance.request('thread/start', {
      cwd: ROOT,
      runtimeWorkspaceRoots: [ROOT],
      approvalPolicy: 'on-request',
      approvalsReviewer: 'auto_review',
      ...permissionSettings,
      serviceName: 'figcodex_local_bridge',
      developerInstructions,
      personality: 'friendly',
      dynamicTools: normalizeTools(message.tools),
      ...(model ? { model } : {}),
    });
    threadId = started?.thread?.id;
    if (!threadId) throw new Error('Codex app-server did not return a thread id.');
  }

  threadOwners.set(threadId, socket);
  socket.figcodexThreads.add(threadId);
  const imagePaths = await saveImages(message.chatId, message.images);
  const importedContext = !resumed && message.fallbackContext
    ? `Imported conversation context from the previous FigClaw provider:\n\n${String(message.fallbackContext).slice(0, 30_000)}\n\n---\n\n`
    : '';
  const input = [
    { type: 'text', text: `${importedContext}${String(message.prompt || '')}`, text_elements: [] },
    ...imagePaths.map((imagePath) => ({ type: 'localImage', path: imagePath })),
  ];
  threadPromptContexts.set(threadId, String(message.prompt || '').slice(0, 80_000));
  let turn;
  try {
    turn = await instance.request('turn/start', {
      threadId,
      input,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
    });
  } catch (error) {
    threadPromptContexts.delete(threadId);
    throw error;
  }
  const turnId = turn?.turn?.id;
  if (turnId) {
    activeTurns.set(threadId, turnId);
    turnContexts.set(turnId, String(message.prompt || '').slice(0, 80_000));
  }
  send(socket, { type: 'turn.accepted', requestId: message.requestId, threadId, turnId });
}

async function handleMessage(socket, message, token) {
  if (!socket.figcodexAuthenticated) {
    if (message.type !== 'authenticate' || !sameToken(message.token, token)) {
      send(socket, { type: 'auth.error', error: 'Bridge pairing token is invalid.' });
      socket.close(4001, 'Unauthorized');
      return;
    }
    socket.figcodexAuthenticated = true;
    const instance = await ensureCodex();
    send(socket, {
      type: 'bridge.ready',
      bridgeVersion: BRIDGE_VERSION,
      cliVersion: codexInfo?.version || '',
      codexBin: codexInfo?.binary || '',
      auth: loginStatus?.message || 'Logged in',
      models,
      permissionProfiles,
      appServerReady: Boolean(instance.started),
    });
    return;
  }

  if (message.type === 'turn.start') {
    await startTurn(socket, message);
    return;
  }
  if (message.type === 'turn.interrupt') {
    const threadId = String(message.threadId || '');
    const turnId = String(message.turnId || activeTurns.get(threadId) || '');
    if (threadId && turnId) await (await ensureCodex()).request('turn/interrupt', { threadId, turnId });
    return;
  }
  if (message.type === 'tool.result') {
    const pending = pendingToolCalls.get(String(message.requestId));
    if (!pending || pending.socket !== socket) return;
    pendingToolCalls.delete(String(message.requestId));
    const result = message.result === undefined ? { ok: true } : message.result;
    const success = message.success !== false && !(result && typeof result === 'object' && 'error' in result);
    (await ensureCodex()).respond(pending.requestId, {
      contentItems: [{ type: 'inputText', text: JSON.stringify(result).slice(0, 500_000) }],
      success,
    });
    return;
  }
  if (message.type === 'models.list') {
    send(socket, { type: 'models.list', models });
  }
}

const token = await ensureToken();
await ensureCodex().catch((error) => {
  startupError = publicError(error);
  console.error(`Codex preflight failed: ${startupError}`);
});

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(startupError ? 503 : 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({
      ok: !startupError,
      service: 'figcodex-codex-bridge',
      version: BRIDGE_VERSION,
      cliVersion: codexInfo?.version || null,
      loggedIn: Boolean(loginStatus?.ok),
      requiresPairingToken: true,
      error: startupError,
    }));
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});
server.on('error', async (error) => {
  console.error(`FigCodex bridge could not listen on ${HOST}:${PORT}: ${publicError(error)}`);
  await codex?.stop();
  process.exit(1);
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request);
  });
});

webSocketServer.on('connection', (socket) => {
  sockets.add(socket);
  socket.figcodexAuthenticated = false;
  socket.figcodexThreads = new Set();
  const authTimer = setTimeout(() => socket.close(4001, 'Authentication timeout'), 8_000);
  authTimer.unref();

  socket.on('message', async (raw) => {
    try {
      const message = JSON.parse(String(raw));
      await handleMessage(socket, message, token);
      if (socket.figcodexAuthenticated) clearTimeout(authTimer);
    } catch (error) {
      send(socket, { type: 'bridge.error', error: publicError(error) });
    }
  });
  socket.on('close', () => {
    clearTimeout(authTimer);
    sockets.delete(socket);
    for (const threadId of socket.figcodexThreads) {
      if (threadOwners.get(threadId) === socket) threadOwners.delete(threadId);
    }
    for (const [requestId, pending] of pendingToolCalls.entries()) {
      if (pending.socket !== socket) continue;
      pendingToolCalls.delete(requestId);
      codex?.respond(pending.requestId, {
        contentItems: [{ type: 'inputText', text: 'FigCodex plugin disconnected before the tool completed.' }],
        success: false,
      });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`FigCodex Bridge listening on http://${HOST}:${PORT}`);
  console.log(`Pairing token: ${token}`);
  if (codexInfo) console.log(`Codex CLI ${codexInfo.version}: ${codexInfo.binary}`);
  if (startupError) console.log(`Startup warning: ${startupError}`);
});

async function shutdown() {
  for (const socket of sockets) socket.close(1001, 'Bridge shutting down');
  await codex?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
