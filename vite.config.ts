import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // SvelteKit only exposes .env via $env/* imports. Our server code reads
  // process.env directly (so production with adapter-node Just Works), so we
  // inject .env into process.env here at dev startup.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (!process.env[k]) process.env[k] = v;
  }

  return {
    plugins: [sveltekit()],
    server: { port: 5173, host: '0.0.0.0' }
  };
});
