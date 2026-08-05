<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    for?: string;
    badge?: Snippet;
    children: Snippet;
  }

  let { label, for: labelFor, badge, children }: Props = $props();
</script>

<div class="form-field">
  {#if label || badge}
    <div class="field-header">
      {#if label}<label for={labelFor}>{label}</label>{/if}
      {#if badge}{@render badge()}{/if}
    </div>
  {/if}
  {@render children()}
</div>

<style>
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .field-header {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  label {
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 520;
    margin: 0;
  }
</style>
