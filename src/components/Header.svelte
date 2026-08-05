<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import logoUrl from '../assets/figcodex-logo.png';

  export type Tab = 'chat' | 'skills' | 'settings' | 'history';

  let {
    activeTab = $bindable<Tab>('chat'),
    onClear,
  }: {
    activeTab: Tab;
    onClear: () => void;
  } = $props();
</script>

<header class="header">
  <div class="product-bar">
    <div class="brand" aria-label="FigCodex">
      <span class="brand-mark" aria-hidden="true">
        <img src={logoUrl} alt="" />
      </span>
      <span class="brand-name">FigCodex</span>
    </div>
    {#if activeTab === 'chat'}
      <Button onclick={onClear} variant="ghost" title="New chat"><Icon name="plus" /></Button>
    {/if}
  </div>
  <nav class="tabs-shell" aria-label="FigCodex sections">
    <button class="tab-btn" class:active={activeTab === 'chat'} aria-current={activeTab === 'chat' ? 'page' : undefined} onclick={() => (activeTab = 'chat')}>Chat</button>
    <button class="tab-btn" class:active={activeTab === 'skills'} aria-current={activeTab === 'skills' ? 'page' : undefined} onclick={() => (activeTab = 'skills')}>Skills</button>
    <button class="tab-btn" class:active={activeTab === 'history'} aria-current={activeTab === 'history' ? 'page' : undefined} onclick={() => (activeTab = 'history')}>History</button>
    <button class="tab-btn" class:active={activeTab === 'settings'} aria-current={activeTab === 'settings' ? 'page' : undefined} onclick={() => (activeTab = 'settings')}>Settings</button>
  </nav>
</header>

<style>
  .header {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border-1);
  }

  .product-bar {
    width: 100%;
    min-height: 48px;
    padding: 9px var(--spacing-inner-padding) 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: #111116;
  }

  .brand-mark img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .brand-name {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .tabs-shell {
    width: 100%;
    display: flex;
    gap: 2px;
    padding: 0 8px;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    position: relative;
    color: var(--color-text-secondary);
    border: none;
    background: transparent;
    height: 34px;
    padding: 0 9px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    line-height: 1;
  }

  .tab-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-1);
  }

  .tab-btn.active {
    color: var(--color-text-primary);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    left: 9px;
    right: 9px;
    bottom: -1px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--color-text-primary);
  }
</style>
