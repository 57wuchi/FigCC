<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  export type ReasoningEffortOption = {
    id: string;
    description?: string;
  };

  export type CodexModelOption = {
    id: string;
    label: string;
    isDefault?: boolean;
    supportedReasoningEfforts?: ReasoningEffortOption[];
    defaultReasoningEffort?: string;
  };

  let {
    model = $bindable(''),
    effort = $bindable(''),
    models = [],
    disabled = false,
    onchange,
  }: {
    model: string;
    effort: string;
    models?: CodexModelOption[];
    disabled?: boolean;
    onchange?: (model: string, effort: string) => void;
  } = $props();

  let root: HTMLElement | null = null;
  let open = $state(false);
  let view = $state<'summary' | 'model' | 'effort'>('summary');

  const selectedModel = $derived(
    models.find((item) => item.id === model)
      || models.find((item) => item.isDefault)
      || models[0]
      || null
  );
  const effortOptions = $derived(selectedModel?.supportedReasoningEfforts || []);
  const effectiveEffort = $derived(effort || selectedModel?.defaultReasoningEffort || '');

  function modelLabel(item: CodexModelOption | null, compact = false): string {
    if (!item) return compact ? 'Codex' : 'Codex default';
    const label = item.label
      .replace(/^GPT-/i, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return compact ? label : `${label}${item.isDefault ? ' · default' : ''}`;
  }

  function effortLabel(value: string): string {
    const labels: Record<string, string> = {
      none: 'None',
      minimal: 'Minimal',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      xhigh: 'Extra high',
      max: 'Max',
      ultra: 'Ultra',
    };
    return labels[value.toLowerCase()] || value || 'Default';
  }

  function close() {
    open = false;
    view = 'summary';
  }

  function chooseModel(nextModel: CodexModelOption) {
    model = nextModel.id;
    const supported = new Set((nextModel.supportedReasoningEfforts || []).map((item) => item.id));
    if (effort && !supported.has(effort)) effort = '';
    onchange?.(model, effort);
    view = 'summary';
  }

  function chooseEffort(nextEffort: string) {
    effort = nextEffort;
    onchange?.(model, effort);
    view = 'summary';
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  $effect(() => {
    if (disabled) close();
  });

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (open && root && !root.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  });
</script>

<div class="picker" bind:this={root}>
  <button
    type="button"
    class="trigger"
    onclick={() => {
      open = !open;
      view = 'summary';
    }}
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={`Model ${modelLabel(selectedModel)}, reasoning effort ${effortLabel(effectiveEffort)}`}
    title="Model and reasoning effort"
  >
    <span class="trigger-model">{modelLabel(selectedModel, true)}</span>
    {#if effectiveEffort}
      <span class="trigger-effort">{effortLabel(effectiveEffort)}</span>
    {/if}
    <Icon name="chevron-down" size={10} />
  </button>

  {#if open}
    <div
      class="menu"
      role="dialog"
      aria-label="Model and reasoning effort"
      tabindex="-1"
      onkeydown={handleMenuKeydown}
    >
      {#if view === 'summary'}
        <div class="menu-heading">Run settings</div>
        <button class="summary-row" type="button" onclick={() => (view = 'model')}>
          <span class="row-label">Model</span>
          <span class="row-value">
            {modelLabel(selectedModel, true)}
            <span class="chevron-right"><Icon name="chevron-down" size={11} /></span>
          </span>
        </button>
        <button class="summary-row" type="button" onclick={() => (view = 'effort')} disabled={!selectedModel}>
          <span class="row-label">Reasoning effort</span>
          <span class="row-value">
            {effortLabel(effectiveEffort)}
            <span class="chevron-right"><Icon name="chevron-down" size={11} /></span>
          </span>
        </button>
        <p class="menu-note">Applies to the next message and later turns in this chat.</p>
      {:else}
        <div class="submenu-heading">
          <button
            class="back-button"
            type="button"
            onclick={() => (view = 'summary')}
            aria-label="Back to run settings"
          >
            <span class="chevron-left"><Icon name="chevron-down" size={12} /></span>
          </button>
          <span>{view === 'model' ? 'Model' : 'Reasoning effort'}</span>
        </div>

        <div class="option-list" role="listbox" aria-label={view === 'model' ? 'Model' : 'Reasoning effort'}>
          {#if view === 'model'}
            {#each models as item (item.id)}
              <button
                class="option"
                type="button"
                role="option"
                aria-selected={selectedModel?.id === item.id}
                onclick={() => chooseModel(item)}
              >
                <span class="option-copy">
                  <span class="option-title">{modelLabel(item)}</span>
                </span>
                {#if selectedModel?.id === item.id}<Icon name="tick" size={13} />{/if}
              </button>
            {/each}
          {:else}
            <button
              class="option"
              type="button"
              role="option"
              aria-selected={!effort}
              onclick={() => chooseEffort('')}
            >
              <span class="option-copy">
                <span class="option-title">Model default</span>
                <span class="option-description">{effortLabel(selectedModel?.defaultReasoningEffort || '')}</span>
              </span>
              {#if !effort}<Icon name="tick" size={13} />{/if}
            </button>
            {#each effortOptions as item (item.id)}
              <button
                class="option"
                type="button"
                role="option"
                aria-selected={effort === item.id}
                onclick={() => chooseEffort(item.id)}
              >
                <span class="option-copy">
                  <span class="option-title">{effortLabel(item.id)}</span>
                  {#if item.description}<span class="option-description">{item.description}</span>{/if}
                </span>
                {#if effort === item.id}<Icon name="tick" size={13} />{/if}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    min-width: 0;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 190px;
    height: var(--height-btn);
    padding: 0 7px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
    transition: background-color 0.15s, color 0.15s;
  }

  .trigger:not(:disabled):hover,
  .trigger[aria-expanded='true'] {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .trigger:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .trigger-model,
  .trigger-effort {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trigger-model { color: currentColor; }
  .trigger-effort { color: var(--color-text-tertiary); }

  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    z-index: 30;
    width: 300px;
    max-width: calc(100vw - 54px);
    overflow: hidden;
    border: 1px solid var(--color-border-2);
    border-radius: var(--radius-lg);
    background: #1c1c1c;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.5);
  }

  .menu-heading,
  .submenu-heading {
    color: var(--color-text-tertiary);
    font-size: 10px;
    font-weight: 620;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .menu-heading { padding: 10px 11px 6px; }

  .summary-row,
  .option {
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    padding: 0 10px;
    font-size: 12px;
  }

  .summary-row:hover,
  .option:hover {
    background: var(--color-surface-2);
  }

  .row-label { font-weight: 560; }

  .row-value {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    color: var(--color-text-secondary);
  }

  .chevron-right,
  .chevron-left {
    display: inline-flex;
    color: var(--color-text-tertiary);
  }

  .chevron-right { transform: rotate(-90deg); }
  .chevron-left { transform: rotate(90deg); }

  .menu-note {
    margin: 5px 10px 10px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border-1);
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1.4;
  }

  .submenu-heading {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 38px;
    padding: 4px 7px;
    border-bottom: 1px solid var(--color-border-1);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .back-button:hover { background: var(--color-surface-2); }

  .option-list {
    max-height: 260px;
    overflow-y: auto;
    padding: 4px;
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 38px;
    padding: 7px 8px;
    border-radius: var(--radius-sm);
  }

  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .option-title {
    overflow: hidden;
    color: var(--color-text-primary);
    font-size: 12px;
    font-weight: 520;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-description {
    overflow: hidden;
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
