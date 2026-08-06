import { unwatchFile, watchFile } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_SKILL_BYTES = 128 * 1024;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const WATCH_DEBOUNCE_MS = 150;
const WATCH_POLL_INTERVAL_MS = 500;

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function yamlValue(source, key) {
  const match = String(source || '').match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return match?.[1]?.trim() || '';
}

function titleFromContent(content, fallback) {
  const frontmatter = String(content).match(/^---\s*\n([\s\S]*?)\n---/);
  const named = frontmatter ? yamlValue(frontmatter[1], 'name') : '';
  if (named) return named;
  return String(content).match(/^#\s+(?:Skill:\s*)?(.+)$/m)?.[1]?.trim() || fallback;
}

function descriptionFromContent(content, fallback) {
  const frontmatter = String(content).match(/^---\s*\n([\s\S]*?)\n---/);
  const described = frontmatter ? yamlValue(frontmatter[1], 'description') : '';
  if (described) return described;
  const prose = String(content)
    .replace(/^---[\s\S]*?---\s*/m, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  return (prose || fallback).slice(0, 300);
}

function quoteYaml(value) {
  return JSON.stringify(String(value || '').replace(/\s+/g, ' ').trim());
}

function withFrontmatter(content, slug, name) {
  const source = String(content || '').trim();
  const existing = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (existing) {
    const body = existing[1];
    const nextBody = /^name:\s*.*$/m.test(body)
      ? body.replace(/^name:\s*.*$/m, `name: ${slug}`)
      : `name: ${slug}\n${body}`;
    return `${source.replace(existing[0], `---\n${nextBody}\n---`)}\n`;
  }
  const description = descriptionFromContent(source, `Instructions for ${name}.`);
  return [
    '---',
    `name: ${slug}`,
    `description: ${quoteYaml(description)}`,
    '---',
    '',
    source,
    '',
  ].join('\n');
}

export class SkillStore {
  constructor({ root, dataDir, modeFile = null }) {
    this.root = root;
    this.skillsDir = path.join(root, 'skills');
    this.modeFile = modeFile || path.join(dataDir, 'skill-modes.json');
  }

  async readModes() {
    try {
      const value = JSON.parse(await readFile(this.modeFile, 'utf8'));
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  async writeModes(modes) {
    await mkdir(path.dirname(this.modeFile), { recursive: true });
    await writeFile(this.modeFile, `${JSON.stringify(modes, null, 2)}\n`, { mode: 0o600 });
  }

  async list() {
    const entries = await readdir(this.skillsDir, { withFileTypes: true }).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
    const modes = await this.readModes();
    const skills = [];
    for (const entry of entries.slice(0, 200)) {
      let id = '';
      let filePath = '';
      let fileName = '';
      if (entry.isDirectory() && SLUG_PATTERN.test(entry.name)) {
        id = entry.name;
        fileName = `${entry.name}/SKILL.md`;
        filePath = path.join(this.skillsDir, fileName);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        id = slugify(entry.name.replace(/\.md$/i, ''));
        fileName = entry.name;
        filePath = path.join(this.skillsDir, fileName);
      }
      if (!id || !filePath) continue;
      const info = await lstat(filePath).catch(() => null);
      if (!info?.isFile() || info.size > MAX_SKILL_BYTES) continue;
      // External editors commonly replace files atomically. If the file changes
      // between lstat and readFile, skip this entry and let the watcher retry.
      const content = await readFile(filePath, 'utf8').catch(() => null);
      if (content === null) continue;
      skills.push({
        id,
        name: titleFromContent(content, id),
        description: descriptionFromContent(content, `Instructions for ${id}.`),
        content,
        fileName,
        addedAt: Math.round(info.mtimeMs),
        // Filesystem-discovered skills are instruction-bearing content. Keep
        // them opt-in unless the user has explicitly saved an active mode.
        mode: modes[id] === 'active' ? 'active' : 'passive',
      });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  async disabledNativeSkillConfig() {
    const skills = await this.list();
    return {
      skills: {
        config: skills.map((skill) => ({
          path: path.join(this.skillsDir, skill.fileName),
          enabled: false,
        })),
      },
    };
  }

  async watchChanges(onChange, onError) {
    let debounceTimer = null;
    let closed = false;
    const watchedPaths = new Set();

    const syncWatchedPaths = async () => {
      // Watch the project root as well as the skills directory so creating a
      // previously missing `skills/` folder is detected without mutating the
      // selected workspace merely by linking it.
      const nextPaths = new Set([this.root, this.skillsDir]);
      const entries = await readdir(this.skillsDir, { withFileTypes: true }).catch((error) => {
        if (error?.code === 'ENOENT') return [];
        throw error;
      });
      for (const entry of entries.slice(0, 200)) {
        if (entry.isDirectory() && SLUG_PATTERN.test(entry.name)) {
          const directory = path.join(this.skillsDir, entry.name);
          nextPaths.add(directory);
          nextPaths.add(path.join(directory, 'SKILL.md'));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          nextPaths.add(path.join(this.skillsDir, entry.name));
        }
      }
      for (const watchedPath of watchedPaths) {
        if (nextPaths.has(watchedPath)) continue;
        unwatchFile(watchedPath, scheduleRefresh);
        watchedPaths.delete(watchedPath);
      }
      for (const watchedPath of nextPaths) {
        if (watchedPaths.has(watchedPath)) continue;
        watchFile(watchedPath, {
          interval: WATCH_POLL_INTERVAL_MS,
          persistent: false,
        }, scheduleRefresh);
        watchedPaths.add(watchedPath);
      }
    };

    function scheduleRefresh() {
      if (closed) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        try {
          await syncWatchedPaths();
          await onChange();
        } catch (error) {
          onError(error);
        }
      }, WATCH_DEBOUNCE_MS);
      debounceTimer.unref?.();
    }

    await syncWatchedPaths();
    return {
      close() {
        closed = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        for (const watchedPath of watchedPaths) {
          unwatchFile(watchedPath, scheduleRefresh);
        }
        watchedPaths.clear();
      },
    };
  }

  async create({ name, content, mode = 'active' }) {
    const slug = slugify(name);
    if (!SLUG_PATTERN.test(slug)) throw new Error('Skill name must contain letters or numbers.');
    const source = withFrontmatter(content, slug, String(name || slug));
    if (Buffer.byteLength(source) > MAX_SKILL_BYTES) throw new Error('Skill exceeds the 128 KB limit.');
    const directory = path.join(this.skillsDir, slug);
    const destination = path.join(directory, 'SKILL.md');
    const packageDirectory = await lstat(directory).catch(() => null);
    const existing = await lstat(destination).catch(() => null);
    if (packageDirectory || existing) throw new Error(`Skill "${slug}" already exists.`);
    await mkdir(directory, { recursive: true });
    await writeFile(destination, source, { mode: 0o600 });
    const modes = await this.readModes();
    modes[slug] = mode === 'passive' ? 'passive' : 'active';
    await this.writeModes(modes);
    return { created: true, id: slug, name: titleFromContent(source, slug) };
  }

  async update({ id, name, content }) {
    const currentId = slugify(id);
    if (!SLUG_PATTERN.test(currentId)) throw new Error('A valid skill id is required.');
    const currentDir = path.join(this.skillsDir, currentId);
    const currentFile = path.join(currentDir, 'SKILL.md');
    const currentDirectory = await lstat(currentDir).catch(() => null);
    const existing = await lstat(currentFile).catch(() => null);
    if (!currentDirectory?.isDirectory()) throw new Error(`Skill "${currentId}" has an invalid package directory.`);
    if (!existing?.isFile()) throw new Error(`Skill "${currentId}" was not found.`);
    const nextId = name ? slugify(name) : currentId;
    if (!SLUG_PATTERN.test(nextId)) throw new Error('Updated skill name is invalid.');
    const source = withFrontmatter(content, nextId, String(name || nextId));
    if (Buffer.byteLength(source) > MAX_SKILL_BYTES) throw new Error('Skill exceeds the 128 KB limit.');
    const nextDir = path.join(this.skillsDir, nextId);
    if (nextId !== currentId) {
      const collision = await lstat(nextDir).catch(() => null);
      if (collision) throw new Error(`Skill "${nextId}" already exists.`);
      await rename(currentDir, nextDir);
    }
    await writeFile(path.join(nextDir, 'SKILL.md'), source, { mode: 0o600 });
    const modes = await this.readModes();
    if (nextId !== currentId && modes[currentId]) {
      modes[nextId] = modes[currentId];
      delete modes[currentId];
      await this.writeModes(modes);
    }
    return { updated: true, id: nextId, name: titleFromContent(source, nextId) };
  }

  async remove(id) {
    const slug = slugify(id);
    if (!SLUG_PATTERN.test(slug)) throw new Error('A valid skill id is required.');
    const directory = path.join(this.skillsDir, slug);
    const file = path.join(directory, 'SKILL.md');
    const packageDirectory = await lstat(directory).catch(() => null);
    const existing = await lstat(file).catch(() => null);
    if (!packageDirectory?.isDirectory()) throw new Error(`Skill "${slug}" has an invalid package directory.`);
    if (!existing?.isFile()) throw new Error(`Skill "${slug}" was not found.`);
    await rm(directory, { recursive: true });
    const modes = await this.readModes();
    delete modes[slug];
    await this.writeModes(modes);
    return { removed: true, id: slug };
  }

  async setMode(id, mode) {
    const slug = slugify(id);
    if (!SLUG_PATTERN.test(slug)) throw new Error('A valid skill id is required.');
    const file = await lstat(path.join(this.skillsDir, slug, 'SKILL.md')).catch(() => null);
    if (!file?.isFile()) throw new Error(`Skill "${slug}" was not found.`);
    const modes = await this.readModes();
    modes[slug] = mode === 'passive' ? 'passive' : 'active';
    await this.writeModes(modes);
    return { id: slug, mode: modes[slug] };
  }

  async importLegacy(rawSkills) {
    const imported = [];
    for (const skill of Array.isArray(rawSkills) ? rawSkills.slice(0, 100) : []) {
      const slug = slugify(skill?.name || skill?.id || skill?.fileName);
      if (!SLUG_PATTERN.test(slug)) continue;
      try {
        imported.push(await this.create({
          name: skill.name || slug,
          content: String(skill.content || ''),
          mode: skill.mode,
        }));
      } catch (error) {
        if (!String(error).includes('already exists')) throw error;
      }
    }
    return { imported: imported.length };
  }
}
