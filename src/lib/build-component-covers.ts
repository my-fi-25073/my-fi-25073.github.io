import { getCollection, type CollectionEntry } from 'astro:content';
import type { DisplayField } from './gallery-display';
import { buildSwitchTuningFields, publicSwitchTunings, switchCoverImage } from './switch-tuning-display';

export type BuildComponentCover = CollectionEntry<'gallery'>['data']['images'][number];
export interface BuildComponentPresentation {
  cover?: BuildComponentCover;
  placeholderLogo?: BuildComponentCover;
  productTitle?: string;
  tuningLabel?: string;
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
    for (const { href, label, tuning } of publicSwitchTunings(record)) {
      const fields = buildSwitchTuningFields(tuning);
      const productTitle = record.title.trim();
      const repeatedName = productTitle === label || productTitle.endsWith(' ' + label);
      components.set(href, {
        cover: switchCoverImage(tuning),
        placeholderLogo: record.manufacturerLogo,
        productTitle,
        tuningLabel: repeatedName ? undefined : label,
        fields: fields.filter(({ key }) => ['spring', 'actuation_force', 'bottom_out_force'].includes(key)),
      });
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
