import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LABEL = 'com.figcodex.bridge';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(ROOT, '.figcodex-data');
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const UID = String(process.getuid());
const SERVICE = `gui/${UID}/${LABEL}`;
const DOMAIN = `gui/${UID}`;

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function launchctl(...args) {
  return execFileSync('/bin/launchctl', args, { encoding: 'utf8' });
}

function bootoutIfLoaded() {
  const result = spawnSync('/bin/launchctl', ['bootout', SERVICE], {
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return result.status === 0;
}

function plist() {
  const nodeDir = path.dirname(process.execPath);
  const environmentPath = `${nodeDir}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>${xml(path.join(ROOT, 'bridge', 'server.js'))}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xml(environmentPath)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${xml(path.join(DATA_DIR, 'bridge-stdout.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(DATA_DIR, 'bridge-stderr.log'))}</string>
</dict>
</plist>
`;
}

async function install() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(path.dirname(PLIST_PATH), { recursive: true });
  bootoutIfLoaded();
  await writeFile(PLIST_PATH, plist(), { mode: 0o644 });
  launchctl('bootstrap', DOMAIN, PLIST_PATH);
  launchctl('enable', SERVICE);
  launchctl('kickstart', '-k', SERVICE);
  console.log(`FigCodex bridge service installed: ${LABEL}`);
  console.log('It will start at login and restart automatically if it exits.');
  console.log(`Status: npm run bridge:status`);
  console.log(`Logs: ${DATA_DIR}`);
}

async function uninstall() {
  bootoutIfLoaded();
  await unlink(PLIST_PATH).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
  console.log(`FigCodex bridge service removed: ${LABEL}`);
}

async function status() {
  const result = spawnSync('/bin/launchctl', ['print', SERVICE], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.log('FigCodex bridge service is not installed or not loaded.');
    process.exitCode = 1;
    return;
  }
  const state = result.stdout.match(/\bstate = ([^\n]+)/)?.[1]?.trim() || 'loaded';
  const pid = result.stdout.match(/\bpid = (\d+)/)?.[1] || '—';
  const token = (await readFile(path.join(DATA_DIR, 'bridge-token'), 'utf8').catch(() => '')).trim();
  console.log(`FigCodex bridge service: ${state}`);
  console.log(`PID: ${pid}`);
  console.log('URL: http://127.0.0.1:4319');
  console.log(`Pairing token: ${token ? 'available via npm run bridge:token' : 'not created yet'}`);
}

const action = process.argv[2] || 'status';
if (action === 'install') await install();
else if (action === 'uninstall') await uninstall();
else if (action === 'status') await status();
else throw new Error(`Unknown action: ${action}`);
