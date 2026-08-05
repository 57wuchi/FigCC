import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('persistent macOS bridge service is installable without embedding its pairing token', async () => {
  const [packageJson, serviceSource, settingsSource, uiSource] = await Promise.all([
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('scripts/bridge-service.js', root), 'utf8'),
    readFile(new URL('src/components/Settings.svelte', root), 'utf8'),
    readFile(new URL('src/UI.svelte', root), 'utf8'),
  ]);

  assert.equal(packageJson.scripts['bridge:install'], 'node scripts/bridge-service.js install');
  assert.equal(packageJson.scripts['bridge:status'], 'node scripts/bridge-service.js status');
  assert.match(serviceSource, /com\.figcodex\.bridge/);
  assert.match(serviceSource, /<key>RunAtLoad<\/key>[\s\S]*?<true\/>/);
  assert.match(serviceSource, /<key>KeepAlive<\/key>[\s\S]*?<true\/>/);
  assert.match(serviceSource, /process\.execPath/);
  assert.doesNotMatch(serviceSource, /FIGCODEX_BRIDGE_TOKEN/);
  assert.match(settingsSource, /npm run bridge:install/);
  assert.match(uiSource, /npm run bridge:install once/);
});
