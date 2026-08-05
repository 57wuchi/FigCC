<script lang="ts">
  import type { HTMLInputTypeAttribute } from 'svelte/elements';

  interface Props {
    id?: string;
    type?: HTMLInputTypeAttribute;
    value: string | number;
    placeholder?: string;
    disabled?: boolean;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
  }

  let { id, value = $bindable(), type, placeholder, disabled = false, oninput }: Props = $props();
</script>

<input {id} {type} bind:value {placeholder} {disabled} {oninput} />

<style>
  input {
    width: 100%;
    border-radius: var(--radius-md);
    font-size: 13px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--color-border-1);
    background: var(--color-surface-1);
    color: var(--color-text-primary);
    outline: none;
  }

  input:focus {
    border-color: var(--color-border-3);
    background: var(--color-surface-2);
  }

  input::placeholder { color: var(--color-text-tertiary); }

  input:disabled {
    opacity: 0.5;
  }
</style>
