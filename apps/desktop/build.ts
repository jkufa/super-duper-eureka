// `vp run desktop#package`: gpuix-svelte's build, which needs Bun. Writes an unsigned
// dist/Retirement Calculator.app on macOS. dist is gitignored.
import { build } from 'gpuix-svelte/build';

const result = await build({ entry: './standalone.ts' });
console.log(JSON.stringify(result, null, 2));
