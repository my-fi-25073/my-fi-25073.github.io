import { readFileSync, watchFile, unwatchFile } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { defineConfig } from 'astro/config';

const studioCollectionManifest = process.env.KEYLOG_STUDIO_COLLECTION_MANIFEST;
if (studioCollectionManifest && !isAbsolute(studioCollectionManifest)) {
  throw new Error('The Studio collection manifest path must be absolute.');
}

function refreshPublishedContent() {
  let stop;
  return {
    name: 'keylog-published-content',
    apply: 'serve',
    configureServer(server) {
      const manifestPath = resolve(server.config.root, '.keylog-manifest.json');
      const readRelease = () => {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          if (typeof manifest.releaseId !== 'string') throw new Error('Publication manifest has no releaseId.');
          return manifest.releaseId;
        } catch (error) {
          if (error.code === 'ENOENT') return null;
          throw error;
        }
      };
      let releaseId = readRelease();
      let restarting = false;
      const onPublication = async () => {
        if (restarting) return;
        try {
          const nextRelease = readRelease();
          if (!nextRelease || nextRelease === releaseId) return;
          releaseId = nextRelease;
          restarting = true;
          server.config.logger.info('[keylog] Published content changed; refreshing content and routes.');
          await server.restart();
        } catch (error) {
          restarting = false;
          server.config.logger.error(`[keylog] Published content refresh failed: ${error.message}`);
        }
      };
      // applyStage writes this file last, after replacing every content tree.
      // Poll only the release boundary; the large media tree needs no watcher.
      watchFile(manifestPath, { interval: 500, persistent: false }, onPublication);
      stop = () => unwatchFile(manifestPath, onPublication);
    },
    closeBundle() { stop?.(); },
  };
}

export default defineConfig({
  site: 'https://my-fi-25073.github.io',
  output: 'static',
  trailingSlash: 'always',
  vite: {
    plugins: [refreshPublishedContent()],
    ...(studioCollectionManifest && {
      resolve: {
        alias: [{
          find: /^(?:\.\.\/)+data\/collections\.json$/u,
          replacement: studioCollectionManifest,
        }],
      },
    }),
  },
});
