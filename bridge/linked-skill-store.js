import crypto from 'node:crypto';
import path from 'node:path';
import { SkillStore } from './skill-store.js';

function workspaceModeFile(dataDir, workspaceRoot) {
  const key = crypto.createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 24);
  return path.join(dataDir, 'workspace-skill-modes', `${key}.json`);
}

export class LinkedSkillStore {
  constructor({ bundledRoot, dataDir }) {
    this.bundledRoot = bundledRoot;
    this.dataDir = dataDir;
    this.bundled = new SkillStore({ root: bundledRoot, dataDir });
    this.workspace = null;
    this.workspaceRoot = null;
  }

  setWorkspace(workspaceRoot) {
    const root = workspaceRoot && workspaceRoot !== this.bundledRoot ? workspaceRoot : null;
    this.workspaceRoot = root;
    this.workspace = root
      ? new SkillStore({
          root,
          dataDir: this.dataDir,
          modeFile: workspaceModeFile(this.dataDir, root),
        })
      : null;
  }

  stores() {
    return this.workspace
      ? [
          { source: 'workspace', store: this.workspace },
          { source: 'bundled', store: this.bundled },
        ]
      : [{ source: 'bundled', store: this.bundled }];
  }

  writableStore() {
    return this.workspace || this.bundled;
  }

  async list() {
    const merged = new Map();
    // Bundled skills are the baseline; same-id workspace skills intentionally
    // override them so a project can customize behavior without editing FigCC.
    const sources = this.workspace
      ? [
          { source: 'bundled', store: this.bundled },
          { source: 'workspace', store: this.workspace },
        ]
      : [{ source: 'bundled', store: this.bundled }];
    for (const { source, store } of sources) {
      for (const skill of await store.list()) merged.set(skill.id, { ...skill, source });
    }
    return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  async disabledNativeSkillConfig() {
    const configs = [];
    for (const { store } of this.stores()) {
      const value = await store.disabledNativeSkillConfig();
      configs.push(...value.skills.config);
    }
    return { skills: { config: configs } };
  }

  async findStore(id) {
    for (const { store } of this.stores()) {
      if ((await store.list()).some((skill) => skill.id === id)) return store;
    }
    return null;
  }

  async create(input) {
    return this.writableStore().create(input);
  }

  async update(input) {
    const target = await this.findStore(input?.id);
    if (!target) return this.writableStore().update(input);
    if (this.workspace && target === this.bundled) {
      return this.workspace.create({
        name: input?.name || input?.id,
        content: input?.content,
        mode: 'active',
      });
    }
    return target.update(input);
  }

  async remove(id) {
    const target = await this.findStore(id);
    if (!target) throw new Error(`Skill "${id}" was not found.`);
    return target.remove(id);
  }

  async setMode(id, mode) {
    const target = await this.findStore(id);
    if (!target) throw new Error(`Skill "${id}" was not found.`);
    return target.setMode(id, mode);
  }

  async importLegacy(skills) {
    return this.writableStore().importLegacy(skills);
  }

  async watchChanges(onChange, onError) {
    const watchers = [];
    try {
      for (const { store } of this.stores()) {
        watchers.push(await store.watchChanges(onChange, onError));
      }
    } catch (error) {
      for (const watcher of watchers) watcher.close();
      throw error;
    }
    return {
      close() {
        for (const watcher of watchers) watcher.close();
      },
    };
  }
}
