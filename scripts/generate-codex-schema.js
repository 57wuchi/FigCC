import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCodex } from '../bridge/codex-discovery.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, '.codex-schema');
await mkdir(output, { recursive: true });
const codex = await discoverCodex();
const child = spawn(codex.binary, ['app-server', 'generate-ts', '--experimental', '--out', output], {
  cwd: root,
  stdio: 'inherit',
});
child.on('close', (code) => {
  if (code === 0) console.log(`Generated Codex ${codex.version} protocol types in ${output}`);
  process.exitCode = code ?? 1;
});
