import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://runsherpa.ai',
  output: 'static',
  build: {
    assets: '_assets'
  }
});
