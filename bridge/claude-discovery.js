import { access, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const EXECUTABLE = process.platform === 'win32' ? 'claude.exe' : 'claude';

async function isExecutable(candidate) {
  if (!candidate) return false;
  try {
    await access(candidate, process.platform === 'win32' ? undefined : 0o1);
    return true;
  } catch {
    return false;
  }
}

function runVersion(binary) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 8_000);
    timer.unref();
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude Code --version exited with code ${code}.`));
        return;
      }
      resolve(output.trim());
    });
  });
}

async function pathCandidates() {
  const home = os.homedir();
  const candidates = [
    process.env.CLAUDE_BIN,
    path.join(home, '.claude', 'local', EXECUTABLE),
    path.join(home, '.local', 'bin', EXECUTABLE),
    path.join(home, '.volta', 'bin', EXECUTABLE),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    ...String(process.env.PATH || '').split(path.delimiter).filter(Boolean)
      .map((directory) => path.join(directory, EXECUTABLE)),
  ];
  const nvmRoot = path.join(home, '.nvm', 'versions', 'node');
  const nvmVersions = await readdir(nvmRoot).catch(() => []);
  for (const version of nvmVersions.reverse()) {
    candidates.push(path.join(nvmRoot, version, 'bin', EXECUTABLE));
  }
  return [...new Set(candidates.filter(Boolean))];
}

export async function discoverClaude() {
  for (const binary of await pathCandidates()) {
    if (!await isExecutable(binary)) continue;
    try {
      const versionOutput = await runVersion(binary);
      return {
        binary,
        version: versionOutput.match(/\d+(?:\.\d+){1,3}/)?.[0] || versionOutput.slice(0, 100),
      };
    } catch {
      // Try the next installed candidate.
    }
  }
  throw new Error('Claude Code CLI was not found. Install it, sign in with `claude`, then restart the bridge.');
}
