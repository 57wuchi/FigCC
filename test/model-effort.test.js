import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('composer model and effort choices come from the Codex catalog and reach turn/start', async () => {
  const [server, ui, composer, picker, plugin] = await Promise.all([
    readFile(path.join(root, 'bridge', 'server.js'), 'utf8'),
    readFile(path.join(root, 'src', 'UI.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'components', 'Composer.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'components', 'ModelPicker.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'code.ts'), 'utf8'),
  ]);

  assert.ok(server.includes('supportedReasoningEfforts'));
  assert.ok(server.includes('defaultReasoningEffort'));
  assert.ok(server.includes('...(effort ? { effort } : {})'));
  assert.ok(ui.includes("type: 'save-runtime-preferences'"));
  assert.ok(ui.includes('effort,'));
  assert.ok(ui.includes('permissionProfile: nextPermissionProfile'));
  assert.ok(composer.includes('<ModelPicker'));
  assert.ok(picker.includes('Reasoning effort'));
  assert.ok(picker.includes('Model default'));
  assert.ok(plugin.includes("msg.type === 'save-runtime-preferences'"));
});
