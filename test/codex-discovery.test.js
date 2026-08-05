import assert from 'node:assert/strict';
import test from 'node:test';
import { __test } from '../bridge/codex-discovery.js';

test('parseVersion accepts stable and prerelease Codex versions', () => {
  assert.deepEqual(__test.parseVersion('codex-cli 0.144.5'), {
    text: '0.144.5',
    parts: [0, 144, 5],
    prerelease: false,
  });
  assert.deepEqual(__test.parseVersion('codex-cli 0.146.0-alpha.9.2'), {
    text: '0.146.0-alpha.9.2',
    parts: [0, 146, 0],
    prerelease: true,
  });
  assert.equal(__test.parseVersion('not codex'), null);
});

test('compareVersion puts the newest capable CLI first', () => {
  const candidates = [
    { version: __test.parseVersion('codex-cli 0.21.0') },
    { version: __test.parseVersion('codex-cli 0.144.5') },
    { version: __test.parseVersion('codex-cli 0.146.0-alpha.9.2') },
  ];
  candidates.sort(__test.compareVersion);
  assert.equal(candidates[0].version.text, '0.146.0-alpha.9.2');
});

test('compareVersion prefers stable when numeric versions are equal', () => {
  const candidates = [
    { version: __test.parseVersion('codex-cli 1.2.3-beta.1') },
    { version: __test.parseVersion('codex-cli 1.2.3') },
  ];
  candidates.sort(__test.compareVersion);
  assert.equal(candidates[0].version.text, '1.2.3');
});
