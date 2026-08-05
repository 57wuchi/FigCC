import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PERMISSION_PROFILE_ID,
  normalizePermissionProfiles,
  resolvePermissionProfile,
} from '../bridge/permission-profiles.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('permission profiles are bounded, allowed, and fail back to read only', () => {
  const profiles = normalizePermissionProfiles({
    data: [
      { id: ':read-only', description: null, allowed: true },
      { id: ':workspace', description: 'Project writes', allowed: true },
      { id: ':danger-full-access', description: null, allowed: false },
      { id: '', description: null, allowed: true },
    ],
  });

  assert.deepEqual(profiles, [
    { id: ':read-only', description: '', allowed: true },
    { id: ':workspace', description: 'Project writes', allowed: true },
  ]);
  assert.equal(resolvePermissionProfile(profiles, ':workspace'), ':workspace');
  assert.equal(resolvePermissionProfile(profiles, ':danger-full-access'), ':read-only');
  assert.equal(resolvePermissionProfile([], ':workspace'), DEFAULT_PERMISSION_PROFILE_ID);
  assert.equal(normalizePermissionProfiles(null)[0].id, DEFAULT_PERMISSION_PROFILE_ID);
});

test('live CLI permission profiles reach the composer and App Server thread settings', async () => {
  const [server, ui, composer, picker, plugin] = await Promise.all([
    readFile(path.join(root, 'bridge', 'server.js'), 'utf8'),
    readFile(path.join(root, 'src', 'UI.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'components', 'Composer.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'components', 'PermissionPicker.svelte'), 'utf8'),
    readFile(path.join(root, 'src', 'code.ts'), 'utf8'),
  ]);

  assert.ok(server.includes("instance.request('permissionProfile/list'"));
  assert.ok(server.includes('{ permissions: permissionProfile }'));
  assert.ok(server.includes("{ sandbox: 'read-only' }"));
  assert.ok(server.includes('permissionProfiles,'));
  assert.ok(ui.includes('permissionProfile,'));
  assert.ok(ui.includes('bind:permissionProfile'));
  assert.ok(composer.includes('<PermissionPicker'));
  assert.ok(picker.includes('Canvas edits always run directly'));
  assert.ok(picker.includes(':danger-full-access'));
  assert.ok(plugin.includes("permissionProfile: ':read-only'"));
  assert.ok(plugin.includes('msg.permissionProfile'));
});
