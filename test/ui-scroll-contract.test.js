import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('non-chat tabs remain vertically scrollable within the plugin viewport', async () => {
  const ui = await readFile(path.join(root, 'src', 'UI.svelte'), 'utf8');
  const autoHeightRule = ui.match(/main\.auto-height\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(autoHeightRule, /max-height:\s*100vh/);
  assert.match(autoHeightRule, /overflow-y:\s*auto/);
  assert.doesNotMatch(autoHeightRule, /overflow:\s*visible/);
});
