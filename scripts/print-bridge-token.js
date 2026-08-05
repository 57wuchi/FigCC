import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokenPath = path.join(root, '.figcodex-data', 'bridge-token');
const legacyTokenPath = path.join(root, '.figclaw-data', 'bridge-token');
const token = await readFile(tokenPath, 'utf8').catch(() => '')
  || await readFile(legacyTokenPath, 'utf8').catch(() => '');
if (!token.trim()) {
  console.error('Bridge token does not exist yet. Run `npm run bridge` once first.');
  process.exitCode = 1;
} else {
  console.log(token.trim());
}
