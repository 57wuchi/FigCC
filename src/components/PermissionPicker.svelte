<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  export type PermissionProfile = {
    id: string;
    description?: string;
    allowed?: boolean;
  };
  export type CodexPermissionProfile = PermissionProfile;

  let {
    permissionProfile = $bindable(':read-only'),
    profiles = [],
    providerLabel = 'provider',
    disabled = false,
    onchange,
  }: {
    permissionProfile: string;
    profiles?: PermissionProfile[];
    providerLabel?: string;
    disabled?: boolean;
    onchange?: (permissionProfile: string) => void;
  } = $props();

  let root: HTMLElement | null = null;
  let open = $state(false);
  const selectedProfile = $derived(
    profiles.find((profile) => profile.id === permissionProfile)
      || profiles.find((profile) => profile.id === ':read-only')
      || profiles[0]
      || null
  );

  function profileLabel(id: string, compact = false): string {
    const labels: Record<string, string> = {
      ':read-only': compact ? 'Read only' : 'Read only',
      ':workspace': compact ? 'Workspace' : 'Workspace access',
      ':auto': compact ? 'Auto' : 'Automatic review',
      ':danger-full-access': compact ? 'Full access' : 'Full access',
    };
    return labels[id] || id.replace(/^:/, '').replace(/-/g, ' ') || 'Read only';
  }

  function profileDescription(profile: PermissionProfile): string {
    if (profile.description) return profile.description;
    const descriptions: Record<string, string> = {
      ':read-only': 'Inspect project files. Local writes require automatic review.',
      ':workspace': 'Read and write files inside this project without another review.',
      ':auto': 'Let the selected provider classify local permission prompts automatically.',
      ':danger-full-access': 'No filesystem sandbox. Use only for a task you trust.',
    };
    return descriptions[profile.id] || `Permission profile provided by the local ${providerLabel} runtime.`;
  }

  function choose(profile: PermissionProfile) {
    permissionProfile = profile.id;
    onchange?.(permissionProfile);
    open = false;
  }

  function close() {
    open = false;
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
    class:danger={selectedProfile?.id === ':danger-full-access'}
    class="trigger"
    onclick={() => (open = !open)}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={`Permissions: ${profileLabel(selectedProfile?.id || ':read-only')}`}
    title="Filesystem permissions"
  >
    <span>{profileLabel(selectedProfile?.id || ':read-only', true)}</span>
    <Icon name="chevron-down" size={9} />
  </button>

  {#if open}
    <div
      class="menu"
      role="listbox"
      aria-label="Filesystem permissions"
      tabindex="-1"
      onkeydown={handleMenuKeydown}
    >
      <div class="menu-heading">Permissions</div>
      <div class="option-list">
        {#each profiles as profile (profile.id)}
          <button
            class:danger-option={profile.id === ':danger-full-access'}
            class="option"
            type="button"
            role="option"
            aria-selected={selectedProfile?.id === profile.id}
            onclick={() => choose(profile)}
          >
            <span class="option-copy">
              <span class="option-title">{profileLabel(profile.id)}</span>
              <span class="option-description">{profileDescription(profile)}</span>
            </span>
            {#if selectedProfile?.id === profile.id}<Icon name="tick" size={13} />{/if}
          </button>
        {/each}
      </div>
      <p class="menu-note">Canvas edits always run directly. This setting controls local project files.</p>
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    min-width: 0;
    max-width: 88px;
    flex: 0 1 76px;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    max-width: 88px;
    height: var(--height-btn);
    padding: 0 7px;
    overflow: hidden;
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

  .trigger span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trigger:not(:disabled):hover,
  .trigger[aria-expanded='true'] {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .trigger.danger { color: var(--color-orange); }

  .trigger:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .menu {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    z-index: 31;
    width: 284px;
    max-width: calc(100vw - 54px);
    overflow: hidden;
    border: 1px solid var(--color-border-2);
    border-radius: var(--radius-lg);
    background: #1c1c1c;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.5);
    transform: translateX(-50%);
  }

  .menu-heading {
    padding: 10px 11px 6px;
    color: var(--color-text-tertiary);
    font-size: 10px;
    font-weight: 620;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .option-list { padding: 4px; }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 7px 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
  }

  .option:hover { background: var(--color-surface-2); }
  .option.danger-option .option-title { color: var(--color-orange); }

  .option-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .option-title {
    font-size: 12px;
    font-weight: 560;
  }

  .option-description {
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1.35;
  }

  .menu-note {
    margin: 5px 10px 10px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border-1);
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1.4;
  }
</style>
