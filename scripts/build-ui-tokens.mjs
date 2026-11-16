import { writeFileSync, readFileSync } from 'node:fs';
import { galleryProfileStyles } from '../public/ui/gallery-profiles.mjs';
const destination = new URL('../public/ui/gallery-profiles.css', import.meta.url);
const css = galleryProfileStyles();
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== css) throw new Error('Gallery token CSS is stale. Run npm run ui:tokens.');
} else writeFileSync(destination, css);
