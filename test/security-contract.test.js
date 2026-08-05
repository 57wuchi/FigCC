import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { mcpDisableConfig } from '../bridge/codex-app-server.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('manifest allows only the documentation host and loopback bridge', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'public', 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['https://raw.githubusercontent.com']);
  assert.deepEqual(manifest.networkAccess.devAllowedDomains, ['ws://localhost:4319']);
  assert.ok(!JSON.stringify(manifest).includes('*'));
});

test('plugin runtime has no Anthropic endpoint or model API key setting', async () => {
  const files = ['src/UI.svelte', 'src/code.ts', 'src/components/Settings.svelte', 'src/tools.ts'];
  const source = (await Promise.all(files.map((file) => readFile(path.join(root, file), 'utf8')))).join('\n');
  assert.ok(!source.includes('api.anthropic.com'));
  assert.ok(!source.includes('anthropic-dangerous-direct-browser-access'));
  assert.ok(!source.includes('sk-ant-'));
  assert.ok(source.includes('figcodex_settings_v1'));
  assert.ok(source.includes('figclaw_codex_settings_v1'));
});

test('bridge binds to loopback by default and requires a pairing token', async () => {
  const serverSource = await readFile(path.join(root, 'bridge', 'server.js'), 'utf8');
  const appServerSource = await readFile(path.join(root, 'bridge', 'codex-app-server.js'), 'utf8');
  assert.ok(serverSource.includes("process.env.FIGCODEX_HOST || process.env.FIGCLAW_HOST || '127.0.0.1'"));
  assert.ok(serverSource.includes('requiresPairingToken: true'));
  assert.ok(serverSource.includes("approvalPolicy: 'on-request'"));
  assert.ok(serverSource.includes("approvalsReviewer: 'auto_review'"));
  assert.ok(serverSource.includes("sandbox: 'read-only'"));
  assert.ok(serverSource.includes('runtimeWorkspaceRoots: [ROOT]'));
  assert.ok(appServerSource.includes("args.push('-c', override)"));
});

test('MCP disable overrides accept safe TOML bare-key server names', () => {
  assert.equal(
    mcpDisableConfig('cloudflare-bindings'),
    'mcp_servers.cloudflare-bindings.enabled=false'
  );
  assert.equal(mcpDisableConfig('server"name'), null);
});
