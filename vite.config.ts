import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Server code reads process.env directly, so load .env into it for dev.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    if (!process.env[k]) process.env[k] = v;
  }

  return {
    plugins: [sveltekit({ adapter: adapter({ out: 'build' }), alias: { $lib: 'src/lib' } })],
    server: { port: 5173, host: '0.0.0.0' }
  };
});
