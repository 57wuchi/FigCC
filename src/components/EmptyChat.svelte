<script lang="ts">
  import logoUrl from '../assets/figcodex-logo.png';
</script>

<div class="empty">
  <div class="hero-mark" aria-hidden="true">
    <img src={logoUrl} alt="" />
  </div>
  <div class="intro">
    <h1>Work with your canvas</h1>
    <p>Select a layer or describe a change. FigCodex can inspect the file, reason with Codex, and edit the canvas directly.</p>
  </div>
  <div class="capabilities" aria-label="Available context">
    <span>Selection aware</span>
    <span>Canvas ready</span>
    <span>Local bridge</span>
  </div>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding: 40px 26px;
    text-align: center;
    animation: enter 0.24s ease-out both;
  }

  .hero-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: 18px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: #111116;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  }

  .hero-mark img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .intro {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 320px;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 17px;
    line-height: 1.3;
    font-weight: 620;
    letter-spacing: -0.02em;
  }

  p {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.55;
  }

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 18px;
  }

  .capabilities span {
    padding: 4px 7px;
    border: 1px solid var(--color-border-1);
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    background: var(--color-surface-1);
    font-size: 10px;
  }

  @keyframes enter {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
