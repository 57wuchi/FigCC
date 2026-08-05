<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import ModelPicker, { type CodexModelOption } from './ModelPicker.svelte';

  export type AttachedImage = {
    dataUrl: string;
    mediaType: string;
    name: string;
    source?: 'upload' | 'figma-selection';
    nodeId?: string;
  };
  export type SelectionContextNode = {
    id: string;
    name: string;
    type: string;
    kind: 'text' | 'image' | 'visual';
    width: number;
    height: number;
    x: number;
    y: number;
    visible: boolean;
    locked?: boolean;
    text?: string;
    textLength?: number;
    textTruncated?: boolean;
    style?: Record<string, unknown>;
    fills?: unknown[];
    previewDataUrl?: string;
  };
  export type SelectionContext = {
    revision: number;
    pageId: string;
    pageName: string;
    total: number;
    truncated: boolean;
    nodes: SelectionContextNode[];
  };
  type Skill = { id: string; name: string; content: string };

  let {
    prompt = $bindable(''),
    attachedImages = $bindable<AttachedImage[]>([]),
    model = $bindable(''),
    effort = $bindable(''),
    models = [],
    selectionContext = null,
    skills = [],
    isSending,
    onSend,
    onStop,
    onDismissSelection,
    onRuntimePreferenceChange,
  }: {
    prompt: string;
    attachedImages: AttachedImage[];
    model: string;
    effort: string;
    models?: CodexModelOption[];
    selectionContext?: SelectionContext | null;
    skills?: Skill[];
    isSending: boolean;
    onSend: () => void;
    onStop?: () => void;
    onDismissSelection?: () => void;
    onRuntimePreferenceChange?: (model: string, effort: string) => void;
  } = $props();

  let fileInput: HTMLInputElement | null = null;
  let textarea: HTMLTextAreaElement | null = null;
  let visibleSelectionNodes = $derived(selectionContext?.nodes.slice(0, 3) || []);

  function dimensions(node: SelectionContextNode): string {
    return `${Math.round(node.width)} × ${Math.round(node.height)}`;
  }

  function textPreview(node: SelectionContextNode): string {
    return String(node.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  // ─── @mention autocomplete ────────────────────────────────────────────────
  let mentionQuery = $state('');
  let mentionStart = $state(-1);
  let showDropdown = $state(false);
  let selectedIndex = $state(0);

  let filteredSkills = $derived(
    mentionQuery === ''
      ? skills
      : skills.filter((s) => s.name.toLowerCase().includes(mentionQuery.toLowerCase()))
  );

  $effect(() => {
    // reset selection when list changes
    selectedIndex = 0;
  });

  function detectMention(value: string, cursorPos: number) {
    const textBefore = value.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx === -1) {
      showDropdown = false;
      mentionStart = -1;
      return;
    }
    // only open if no space between @ and cursor
    const fragment = textBefore.slice(atIdx + 1);
    if (/\s/.test(fragment)) {
      showDropdown = false;
      mentionStart = -1;
      return;
    }
    mentionStart = atIdx;
    mentionQuery = fragment;
    showDropdown = true;
  }

  function insertMention(skill: Skill) {
    if (!textarea) return;
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(textarea.selectionStart);
    const inserted = `@${skill.name} `;
    prompt = before + inserted + after;
    showDropdown = false;
    mentionStart = -1;
    // restore cursor
    const newPos = before.length + inserted.length;
    // tick needed — let Svelte flush the binding first
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(newPos, newPos);
    });
  }

  export function focusTextarea() {
    textarea?.focus();
  }

  let minHeight = 0;

  function autoResize() {
    if (!textarea) return;
    if (minHeight === 0) minHeight = textarea.clientHeight;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, minHeight) + 'px';
  }

  $effect(() => {
    if (textarea) {
      const _ = prompt; // track prompt changes
      autoResize();
    }
  });

  function handleInput() {
    detectMention(prompt, textarea?.selectionStart ?? prompt.length);
    autoResize();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showDropdown && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredSkills.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredSkills.length) % filteredSkills.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredSkills[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        showDropdown = false;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((i) => i.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (file) readFile(file);
    });
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(readFile);
    input.value = '';
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const mediaType = file.type || 'image/png';
      attachedImages = [...attachedImages, { dataUrl, mediaType, name: file.name }];
    };
    reader.readAsDataURL(file);
  }

  function removeImage(index: number) {
    attachedImages = attachedImages.filter((_, i) => i !== index);
  }
</script>

<div class="composer-wrapper">
  {#if showDropdown}
    <div class="mention-dropdown">
      {#if filteredSkills.length > 0}
        {#each filteredSkills as skill, i}
          <button
            class="mention-item"
            class:selected={i === selectedIndex}
            onmousedown={(e) => {
              e.preventDefault();
              insertMention(skill);
            }}
          >
            <span class="mention-at">@</span>{skill.name}
          </button>
        {/each}
      {:else}
        <div class="mention-empty">No passive skills available</div>
      {/if}
    </div>
  {/if}

  <section class="composer">
    {#if selectionContext && selectionContext.nodes.length > 0}
      <section
        class="selection-context"
        aria-label={`${selectionContext.total} selected Figma ${selectionContext.total === 1 ? 'node' : 'nodes'}`}
        aria-live="polite"
      >
        <div class="selection-header">
          <div class="selection-heading">
            <span class="selection-source">Figma selection</span>
            <span class="selection-count">{selectionContext.total}</span>
          </div>
          <button
            class="dismiss-selection"
            type="button"
            onclick={onDismissSelection}
            aria-label="Exclude Figma selection from this message"
            title="Exclude selection"
            disabled={isSending}
          >
            <Icon name="close" size={12} />
          </button>
        </div>

        <div class="selection-items">
          {#each visibleSelectionNodes as node}
            <div class="selection-item">
              {#if node.previewDataUrl}
                <img
                  class="selection-preview"
                  src={node.previewDataUrl}
                  alt={`Preview of ${node.name}`}
                />
              {:else}
                <span class="selection-glyph" aria-hidden="true">
                  {#if node.kind === 'text'}
                    T
                  {:else}
                    <Icon name="preview" size={16} />
                  {/if}
                </span>
              {/if}
              <span class="selection-copy">
                <span class="selection-name" title={node.name}>{node.name}</span>
                <span class="selection-meta">
                  {node.type.toLowerCase()} · {dimensions(node)}
                </span>
                {#if node.kind === 'text' && textPreview(node)}
                  <span class="selection-text" title={node.text}>{textPreview(node)}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>

        {#if selectionContext.total > visibleSelectionNodes.length}
          <span class="selection-more">
            +{selectionContext.total - visibleSelectionNodes.length} more selected
            {selectionContext.truncated ? ' · metadata limited' : ''}
          </span>
        {/if}
      </section>
    {/if}

    {#if attachedImages.length > 0}
      <div class="image-strip">
        {#each attachedImages as img, i}
          <div class="image-thumb">
            <img src={img.dataUrl} alt={img.name} />
            <button class="remove-btn" onclick={() => removeImage(i)} title="Remove">
              <Icon name="close" size={10} />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <textarea
      bind:this={textarea}
      bind:value={prompt}
      onkeydown={handleKeydown}
      oninput={handleInput}
      onpaste={handlePaste}
      rows="3"
      placeholder="Ask Codex to do something in Figma… (type @ to invoke a skill)"
      disabled={isSending}
    ></textarea>

    <div class="divider"></div>

    <div class="actions-row">
      <div class="left-actions">
        <Button
          onclick={() => fileInput?.click()}
          disabled={isSending}
          title="Add image"
          variant="outline"
        >
          <Icon name="image" />
        </Button>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          multiple
          style="display:none"
          onchange={handleFileChange}
        />
        <ModelPicker
          bind:model
          bind:effort
          {models}
          disabled={isSending || models.length === 0}
          onchange={onRuntimePreferenceChange}
        />
      </div>
      {#if isSending}
        <Button variant="outline" onclick={onStop}>
          <Icon name="stop" />
          Stop
        </Button>
      {:else}
        <Button variant="primary" onclick={onSend}>
          Send
          <Icon name="arrow-up" />
        </Button>
      {/if}
    </div>
  </section>
</div>

<style>
  .composer-wrapper {
    position: relative;
    z-index: 1;
    padding: 12px var(--spacing-inner-padding) var(--spacing-inner-padding);
    padding-top: 0;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-1);
    border-radius: var(--radius-lg);
    background: var(--color-surface-1);
    padding: 12px;
    transition:
      border-color 0.15s,
      background-color 0.15s;

    &:focus-within,
    &:hover {
      border-color: var(--color-border-2);
      background: #191919;
    }
  }

  .selection-context {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 8px;
    border: 1px solid var(--color-teal-border);
    border-radius: var(--radius-md);
    background: var(--color-teal-bg);
    min-width: 0;
  }

  .selection-header,
  .selection-heading {
    display: flex;
    align-items: center;
  }

  .selection-header {
    justify-content: space-between;
    min-height: 28px;
  }

  .selection-heading {
    gap: 6px;
    min-width: 0;
  }

  .selection-source {
    color: var(--color-teal);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  .selection-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-2);
    color: var(--color-text-secondary);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .dismiss-selection {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  .dismiss-selection:not(:disabled):hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .dismiss-selection:focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 1px;
  }

  .dismiss-selection:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .selection-items {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .selection-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 42px;
    padding: 4px;
    border-radius: var(--radius-md);
    background: var(--color-overlay-30);
  }

  .selection-preview,
  .selection-glyph {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-1);
  }

  .selection-preview {
    display: block;
    object-fit: cover;
    background: var(--color-surface-1);
  }

  .selection-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-teal);
    background: var(--color-surface-1);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 16px;
    font-weight: 650;
  }

  .selection-copy {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .selection-name,
  .selection-meta,
  .selection-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selection-name {
    color: var(--color-text-primary);
    font-size: 11px;
    font-weight: 550;
  }

  .selection-meta,
  .selection-text,
  .selection-more {
    color: var(--color-text-secondary);
    font-size: 10px;
  }

  .selection-text {
    opacity: 0.75;
  }

  .selection-more {
    padding-left: 4px;
  }

  .image-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .image-thumb {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border-2);
    flex-shrink: 0;

    & .remove-btn {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 18px;
      height: 18px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg);
      border: 1px solid var(--color-border-2);
      border-radius: 50%;
      color: var(--color-text-primary);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
      z-index: 1;
    }

    &:hover .remove-btn {
      opacity: 1;
    }
  }

  .image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: var(--radius-md);
  }

  textarea {
    width: 100%;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    outline: none;
    resize: none;
    line-height: 1.4;
    overflow-y: auto;
    max-height: 160px;
  }

  textarea::placeholder {
    color: var(--color-text-tertiary);
    opacity: 1;
  }

  textarea:disabled {
    opacity: 0.5;
  }

  .mention-dropdown {
    background: var(--color-surface-1);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    border: 1px solid var(--color-border-2);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 4px;
    z-index: 10;
  }

  .mention-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 7px 10px;
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    gap: 2px;

    &:hover,
    &.selected {
      background: var(--color-surface-2);
    }
  }

  .mention-at {
    color: var(--color-teal);
    font-weight: 600;
  }

  .mention-empty {
    padding: 10px;
    font-size: 13px;
    color: var(--color-text-primary);
    opacity: 0.4;
  }

  .divider {
    width: 100%;
    border-top: 1px solid var(--color-border-1);
  }

  .actions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .left-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
</style>
