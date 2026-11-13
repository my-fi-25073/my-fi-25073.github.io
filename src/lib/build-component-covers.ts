import { getCollection, type CollectionEntry } from 'astro:content';
import type { DisplayField } from './gallery-display';
import { buildSwitchTuningFields, publicSwitchTunings } from './switch-tuning-display';

export type BuildComponentCover = CollectionEntry<'gallery'>['data']['images'][number];
export interface BuildComponentPresentation {
  cover?: BuildComponentCover;
  fields?: DisplayField[];
}

export async function loadBuildComponentCoverResolver() {
  const [galleries, switches] = await Promise.all([
    getCollection('gallery'),
    getCollection('records'),
  ]);
  const components = new Map<string, BuildComponentPresentation>();

  for (const { data: gallery } of galleries) {
    const href = `/gallery/${gallery.slug}/`;
    components.set(href, { cover: gallery.images[0] });
    for (const kit of gallery.kits) {
      components.set(`${href}#${kit.slug}`, { cover: kit.images[0] });
    }
  }
  for (const { data: record } of switches) {
    // Existing public builds may still carry a product route until their next publication.
    components.set(`/switches/${record.slug}/`, { cover: record.images[0] });
    for (const { href, tuning } of publicSwitchTunings(record)) {
      components.set(href, { cover: tuning.images[0], fields: buildSwitchTuningFields(tuning) });
    }
  }

  return function withCover<T extends { href: string }>(item: T) {
    const component = components.get(item.href);
    if (!component) {
      throw new Error(`Missing public build component: ${item.href}`);
    }
    return { ...item, ...component };
  };
}
