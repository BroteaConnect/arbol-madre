import { defineConfig } from 'astro/config';

// Static output, served by nginx (see Dockerfile).
export default defineConfig({
  // absolute hreflang alternates need the canonical origin
  site: 'https://app.brotea.dev',
  output: 'static',
});
