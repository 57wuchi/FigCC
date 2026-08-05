import { rollup } from 'rollup';
import configs from '../rollup.config.mjs';

let circularWarnings = 0;

try {
  for (const config of configs) {
    const bundle = await rollup({
      ...config,
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          circularWarnings += 1;
          return;
        }
        warn(warning);
      },
    });
    await bundle.write(config.output);
    await bundle.close();
  }
  if (circularWarnings > 0) {
    console.log(`Build completed (${circularWarnings} circular warnings from Svelte internals suppressed).`);
  } else {
    console.log('Build completed.');
  }
  // @rollup/plugin-typescript can leave TypeScript FSWatcher handles behind in
  // one-shot mode. All bundles are closed and written at this point.
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
