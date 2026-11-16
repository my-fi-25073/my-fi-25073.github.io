// Canonical frame and density profiles, shared by rendering and image processing.
export const galleryProfiles = Object.freeze({ keycap: '6:5', keyboard: '16:9', product: '4:3' });
export function galleryProfile(kind = 'switch') {
  if (kind.startsWith('keycap') || kind === 'kit') return 'keycap';
  return kind === 'keyboard' ? 'keyboard' : 'product';
}
export function galleryAspectRatio(kind = 'switch') { return galleryProfiles[galleryProfile(kind)]; }

export const galleryRoles = Object.freeze({
  archive: { min: '220px', 'gap-x': '20px', 'gap-y': '30px', title: '20px', 'copy-gap': '6px', 'copy-top': '12px' },
  relation: { min: '154px', 'gap-x': '12px', 'gap-y': '12px', title: '14px', 'copy-gap': '4px', 'copy-top': '8px' },
  timeline: { columns: 'repeat(auto-fit, minmax(min(100%, var(--k-gallery-min)), 1fr))', min: '250px', 'gap-x': '16px', 'gap-y': '16px', title: '20px', 'copy-gap': '6px', 'copy-top': '12px', 'card-max': '420px' },
  media: { min: '180px', 'gap-x': '12px', 'gap-y': '12px', title: '14px', 'copy-gap': '4px', 'copy-top': '8px' },
});

export function galleryProfileStyles() {
  const frames = Object.entries(galleryProfiles).map(([name, aspect]) =>
    `[data-gallery-profile="${name}"] { --k-media-ratio: ${aspect.replace(':', ' / ')}; }`);
  const roles = Object.entries(galleryRoles).map(([name, values]) =>
    `[data-gallery-role="${name}"] { ${Object.entries(values).map(([key, value]) => `--k-gallery-${key}: ${value};`).join(' ')} }`);
  return `/* Generated from gallery-profiles.mjs. Run npm run ui:tokens. */\n${[...frames, ...roles].join('\n')}\n`;
}
