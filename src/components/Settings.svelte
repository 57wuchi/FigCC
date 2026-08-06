<script lang="ts">
  import Badge from './Badge.svelte';
  import Button from './Button.svelte';
  import FormField from './FormField.svelte';
  import Icon from './Icon.svelte';
  import Input from './Input.svelte';

  type ProviderState = {
    available?: boolean;
    cliVersion?: string;
    auth?: string;
    error?: string;
  };

  let {
    bridgeUrl = $bindable('http://localhost:4319'),
    bridgeToken = $bindable(''),
    connectionStatus = 'disconnected',
    connectionDetail = '',
    provider = 'codex',
    providers = {},
    onSave,
    onReconnect,
  }: {
    bridgeUrl: string;
    bridgeToken: string;
    connectionStatus?: 'disconnected' | 'connecting' | 'ready' | 'error';
    connectionDetail?: string;
    provider?: 'codex' | 'claude';
    providers?: Partial<Record<'codex' | 'claude', ProviderState>>;
    onSave: () => void;
    onReconnect: () => void;
  } = $props();

</script>

<section class="settings">
  <div class="section-intro">
    <h1>Connection</h1>
    <p>Connect this plugin to local Codex and Claude Code runtimes on your Mac.</p>
  </div>

  <FormField label="FigCodex bridge" for="bridge-url">
    {#snippet badge()}
      {#if connectionStatus === 'ready'}
        <Badge variant="saved">Connected</Badge>
      {:else if connectionStatus === 'connecting'}
        <Badge variant="label">Connecting</Badge>
      {:else}
        <Badge variant="missing">{connectionStatus}</Badge>
      {/if}
    {/snippet}
    <Input id="bridge-url" bind:value={bridgeUrl} placeholder="http://localhost:4319" />
  </FormField>

  <div aria-live="polite">
    {#if connectionDetail}
      <div class:error-detail={connectionStatus === 'error'} class="detail">{connectionDetail}</div>
    {/if}
  </div>

  <FormField label="Local pairing token" for="bridge-token">
    {#snippet badge()}
      {#if bridgeToken.trim()}
        <Badge variant="saved">Set</Badge>
      {:else}
        <Badge variant="missing">Required</Badge>
      {/if}
    {/snippet}
    <Input id="bridge-token" type="password" bind:value={bridgeToken} placeholder="Run npm run bridge:token to get it" />
    <div class="hint">
      Required for the local connection only. This is not a model API key; each provider reuses its own CLI login.
    </div>
  </FormField>

  <div class="provider-grid" aria-label="Local providers">
    {#each ['codex', 'claude'] as id}
      {@const item = providers[id as 'codex' | 'claude']}
      <div class="provider-card" class:selected-provider={provider === id}>
        <div class="permission-title">
          <span>{id === 'claude' ? 'Claude Code' : 'Codex CLI'}</span>
          <Badge variant={item?.available ? 'saved' : 'missing'}>
            {item?.available ? 'Ready' : 'Unavailable'}
          </Badge>
        </div>
        <div class="hint">
          {#if item?.available}
            {item.cliVersion || 'Installed'}{item.auth ? ` · ${item.auth}` : ''}
          {:else}
            {item?.error || `Install and sign in to ${id === 'claude' ? 'Claude Code' : 'Codex CLI'}.`}
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="permission-card">
    <div class="permission-title">
      <span>Filesystem permissions</span>
      <Badge variant="saved">Read only by default</Badge>
    </div>
    <div class="hint">
      Figma canvas edits run directly. Local project writes require automatic review in Read only mode; choose another CLI permission profile beside the model when needed.
    </div>
  </div>

  <div class="actions">
    <Button variant="primary" onclick={onSave}>
      Save &amp; Connect
      <Icon name="tick" />
    </Button>
    <Button variant="outline" onclick={onReconnect}>Reconnect</Button>
  </div>

  <div class="hint steps">
    <p>1. Run <code>npm run bridge:install</code> once to keep the local bridge available.</p>
    <p>2. Run <code>npm run bridge:token</code>, paste the token above, and save.</p>
    <p>3. Sign in with <code>codex login</code> and/or launch <code>claude</code> once to authenticate.</p>
    <p>4. FigCodex stores no model API key. Model, effort, and permissions stay provider-specific.</p>
  </div>
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: var(--spacing-inner-padding);
    flex-shrink: 0;
  }

  .section-intro {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 2px;
  }

  .section-intro h1 {
    color: var(--color-text-primary);
    font-size: 15px;
    font-weight: 620;
    letter-spacing: -0.01em;
  }

  .section-intro p {
    color: var(--color-text-tertiary);
    font-size: 11px;
    line-height: 1.45;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .permission-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 11px;
    border: 1px solid var(--color-border-1);
    border-radius: var(--radius-md);
    background: var(--color-surface-1);
  }

  .provider-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .provider-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--color-border-1);
    border-radius: var(--radius-md);
    background: var(--color-surface-1);
  }

  .provider-card.selected-provider {
    border-color: var(--color-border-3);
  }

  .permission-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .hint,
  .detail {
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .detail {
    border: 1px solid var(--color-border-1);
    border-radius: var(--radius-md);
    padding: 8px;
    overflow-wrap: anywhere;
  }

  .error-detail {
    color: var(--color-danger);
    border-color: var(--color-danger-border);
    background: var(--color-danger-bg);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0.7;
  }

  .steps p {
    margin: 0;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
</style>
