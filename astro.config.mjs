import { defineConfig } from 'astro/config';

// Static output, served by nginx (see Dockerfile).
export default defineConfig({
  output: 'static',
});
