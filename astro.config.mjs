import { isAbsolute } from 'node:path';
import { defineConfig } from 'astro/config';

const studioCollectionManifest = process.env.KEYLOG_STUDIO_COLLECTION_MANIFEST;
if (studioCollectionManifest && !isAbsolute(studioCollectionManifest)) {
  throw new Error('The Studio collection manifest path must be absolute.');
}

export default defineConfig({
  site: 'https://my-fi-25073.github.io',
  output: 'static',
  trailingSlash: 'always',
  ...(studioCollectionManifest && {
    vite: {
      resolve: {
        alias: [{
          find: /^(?:\.\.\/)+data\/collections\.json$/u,
          replacement: studioCollectionManifest,
        }],
      },
    },
  }),
});
