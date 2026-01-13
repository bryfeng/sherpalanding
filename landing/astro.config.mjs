import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bryfeng.github.io',
  base: '/sherpalanding',
  output: 'static',
  build: {
    assets: '_assets'
  }
});
