<script lang="ts">
  import Badge from './Badge.svelte';
  import Button from './Button.svelte';
  import FormField from './FormField.svelte';
  import Icon from './Icon.svelte';
  import Input from './Input.svelte';

  let {
    bridgeUrl = $bindable('http://localhost:4319'),
    bridgeToken = $bindable(''),
    connectionStatus = 'disconnected',
    connectionDetail = '',
    onSave,
    onReconnect,
  }: {
    bridgeUrl: string;
    bridgeToken: string;
    connectionStatus?: 'disconnected' | 'connecting' | 'ready' | 'error';
    connectionDetail?: string;
    onSave: () => void;
    onReconnect: () => void;
  } = $props();

</script>

<section class="settings">
  <div class="section-intro">
    <h1>Connection</h1>
    <p>Connect this plugin to Codex running on your Mac.</p>
  </div>

  <FormField label="Codex bridge" for="bridge-url">
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
      Required for the local connection only. This is not an OpenAI API key; the bridge reuses your Codex CLI login.
    </div>
  </FormField>

  <div class="permission-card">
    <div class="permission-title">
      <span>Permission mode</span>
      <Badge variant="saved">Auto review</Badge>
    </div>
    <div class="hint">
      Project-file escalations and Figma actions that can make changes are reviewed automatically. Read-only canvas inspection runs directly.
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
    <p>3. Codex authentication stays in the local CLI; FigCodex stores no model API key.</p>
    <p>4. Choose the model and reasoning effort beside Send.</p>
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
