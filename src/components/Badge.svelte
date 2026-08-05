<script lang="ts">
  export let variant: 'label' | 'saved' | 'missing' | 'passive' | 'active' = 'label';
</script>

<span class="badge {variant}"><slot /></span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    width: fit-content;
  }

  .badge.label,
  .badge.passive,
  .badge.active,
  .badge.saved,
  .badge.missing {
    gap: 4px;
    font-size: 9px;
    font-weight: 650;
    line-height: 1.2;
    text-transform: uppercase;
    padding: 2px 5px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-2);
  }

  .badge.label {
    color: var(--color-text-secondary);
  }

  .badge.passive {
    background: var(--color-surface-2);
    color: var(--color-text-secondary);
  }

  .badge.active {
    background: var(--color-teal-bg);
    color: var(--color-teal);
    border-color: var(--color-teal-border);
  }

  .badge.saved {
    background: var(--color-green-bg);
    color: var(--color-green);
    border-color: var(--color-green-border);
  }

  .badge.missing {
    background: var(--color-orange-bg);
    color: var(--color-orange);
    border-color: var(--color-orange-border);
  }
</style>
