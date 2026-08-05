import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('open-source package preserves FigClaw attribution and bilingual guidance', async () => {
  const [license, notice, readme, readmeZh, agents, agent, claude, packageJson, header, emptyChat] = await Promise.all([
    readFile(new URL('LICENSE', root), 'utf8'),
    readFile(new URL('NOTICE.md', root), 'utf8'),
    readFile(new URL('README.md', root), 'utf8'),
    readFile(new URL('README.zh-TW.md', root), 'utf8'),
    readFile(new URL('AGENTS.md', root), 'utf8'),
    readFile(new URL('AGENT.md', root), 'utf8'),
    readFile(new URL('CLAUDE.md', root), 'utf8'),
    readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('src/components/Header.svelte', root), 'utf8'),
    readFile(new URL('src/components/EmptyChat.svelte', root), 'utf8'),
  ]);

  assert.match(license, /Copyright \(c\) 2025 Pavel Laptev/);
  assert.match(license, /Copyright \(c\) 2026 FigCodex contributors/);
  assert.match(notice, /https:\/\/github\.com\/PavelLaptev\/FigClaw/);
  assert.match(readme, /derivative work based on \[PavelLaptev\/FigClaw\]/i);
  assert.match(readme, /README\.zh-TW\.md/);
  assert.match(readmeZh, /PavelLaptev\/FigClaw/);
  assert.match(readmeZh, /本機 Codex/);
  assert.match(agents, /Security invariants/);
  assert.match(agent, /AGENTS\.md/);
  assert.match(claude, /does not ask users for a Claude API key/);
  assert.equal(packageJson.license, 'MIT');
  assert.equal(packageJson.author, 'FigCodex contributors');
  assert.match(header, /figcodex-logo\.png/);
  assert.match(emptyChat, /figcodex-logo\.png/);

  await Promise.all([
    access(new URL('icon.png', root)),
    access(new URL('src/assets/figcodex-logo.png', root)),
    access(new URL('docs/attribution/figclaw-original-icon.jpg', root)),
    access(new URL('docs/attribution/figclaw-original-cover.jpg', root)),
  ]);
});
