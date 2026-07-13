import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const imageVariant = z.object({
  src: z.string().startsWith('/media/'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const galleryImage = z.object({
  alt: z.string().min(1),
  caption: z.string().optional(),
  variants: z.array(imageVariant).min(1),
});

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/gallery' }),
  schema: z.object({
    schemaVersion: z.literal(1),
    kind: z.literal('keycap-series'),
    slug: z.string().min(1),
    title: z.string().min(1),
    category: z.literal('keycaps'),
    manufacturer: z.string().nullable(),
    profile: z.string().nullable(),
    manufacturingProcess: z.string().nullable(),
    sleeveStatus: z.string().nullable(),
    createdAt: z.iso.datetime().nullable(),
    materials: z.array(z.string()),
    colors: z.array(z.string()),
    compatibility: z.array(z.string()),
    kits: z.array(z.object({
      slug: z.string().min(1),
      title: z.string().min(1),
      kittingTypes: z.array(z.string()),
      sleeveStatus: z.string().nullable(),
      images: z.array(galleryImage),
    })),
    images: z.array(galleryImage),
  }),
});

export const collections = { gallery };
