import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function isExecutable(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseVersion(output) {
  const match = String(output || '').match(/codex-cli\s+(\d+)\.(\d+)\.(\d+)([^\s]*)?/i);
  if (!match) return null;
  return {
    text: `${match[1]}.${match[2]}.${match[3]}${match[4] || ''}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: Boolean(match[4]),
  };
}

function compareVersion(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a.version.parts[index] !== b.version.parts[index]) {
      return b.version.parts[index] - a.version.parts[index];
    }
  }
  return Number(a.version.prerelease) - Number(b.version.prerelease);
}

async function nvmCandidates() {
  const versionsRoot = path.join(homedir(), '.nvm', 'versions', 'node');
  const versions = await readdir(versionsRoot).catch(() => []);
  return versions.map((version) => path.join(versionsRoot, version, 'bin', 'codex'));
}

export async function listCodexCandidates() {
  if (process.env.CODEX_BIN) return [process.env.CODEX_BIN];

  const pathCandidates = String(process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((directory) => path.join(directory, 'codex'));
  const candidates = [
    path.join(path.dirname(process.execPath), 'codex'),
    ...(await nvmCandidates()),
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    ...pathCandidates,
  ];
  return [...new Set(candidates)];
}

export async function inspectCodex(binary) {
  if (!(await isExecutable(binary))) return null;
  try {
    const [versionResult, helpResult] = await Promise.all([
      execFileAsync(binary, ['--version'], { timeout: 8_000, maxBuffer: 1024 * 1024 }),
      execFileAsync(binary, ['app-server', 'generate-ts', '--help'], {
        timeout: 8_000,
        maxBuffer: 2 * 1024 * 1024,
      }),
    ]);
    const version = parseVersion(versionResult.stdout);
    const help = `${helpResult.stdout}\n${helpResult.stderr}`;
    if (!version || !help.includes('--experimental')) return null;
    return { binary, version };
  } catch {
    return null;
  }
}

export async function discoverCodex() {
  const candidates = await listCodexCandidates();
  const inspected = (await Promise.all(candidates.map(inspectCodex))).filter(Boolean);
  if (inspected.length === 0) {
    const target = process.env.CODEX_BIN
      ? `目前的 CODEX_BIN (${process.env.CODEX_BIN})`
      : 'CODEX_BIN';
    throw new Error(
      `找不到支援 app-server dynamic tools 的 Codex CLI。請更新 Codex，或讓 ${target} 指向新版執行檔。`
    );
  }

  // Prefer the newest capable binary. The ChatGPT desktop app can bundle a
  // prerelease CLI that matches its current config/cache format more closely
  // than an older stable CLI elsewhere on PATH.
  const selected = inspected.sort(compareVersion)[0];
  return {
    binary: selected.binary,
    version: selected.version.text,
    candidates: inspected.map((item) => ({ binary: item.binary, version: item.version.text })),
  };
}

export async function readLoginStatus(binary) {
  try {
    const result = await execFileAsync(binary, ['login', 'status'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const text = `${result.stdout}\n${result.stderr}`.trim();
    return { ok: /logged in/i.test(text), message: text };
  } catch (error) {
    const text = `${error?.stdout || ''}\n${error?.stderr || ''}`.trim();
    return { ok: false, message: text || error.message };
  }
}

export const __test = { parseVersion, compareVersion };
