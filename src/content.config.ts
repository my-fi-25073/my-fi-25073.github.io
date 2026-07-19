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

const keyboards = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/keyboards' }),
  schema: z.object({
    schemaVersion: z.literal(1),
    kind: z.literal('keyboard'),
    slug: z.string().min(1),
    title: z.string().min(1),
    category: z.literal('keyboards'),
    status: z.string().nullable(),
    lastBuiltAt: z.string().nullable(),
    modules: z.array(z.string()),
    plates: z.array(z.string()),
    ergonomicFeatures: z.array(z.string()),
    layouts: z.array(z.string()),
    mounts: z.array(z.string()),
    foams: z.array(z.string()),
    build: z.object({
      label: z.string().min(1),
      state: z.enum(['draft', 'approved', 'retired']),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
      keycaps: z.array(z.object({
        kind: z.enum(['series', 'kit']),
        title: z.string().min(1),
        quantity: z.number().positive().nullable(),
      })),
    }),
    images: z.array(galleryImage).min(1),
  }),
});

const recordBase = {
  schemaVersion: z.literal(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  images: z.array(galleryImage),
};

const records = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/records' }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      ...recordBase,
      kind: z.literal('switch-family'),
      category: z.literal('switches'),
      familyKind: z.enum(['commercial', 'franken', 'unclassified']),
      recipeStatus: z.enum(['not_applicable', 'not_assessed', 'unresolved', 'complete']),
      variants: z.array(z.object({
        label: z.string().min(1),
        reference: z.boolean(),
        rating: z.number().min(0).max(5).nullable(),
        manufacturer: z.string().nullable(),
        footprintType: z.string().nullable(),
        switchTypes: z.array(z.string()),
        spring: z.object({
          resolution: z.enum(['inherit', 'selected', 'stock_unresolved', 'unknown']),
          name: z.string().nullable(),
          status: z.enum(['unresolved', 'partial', 'conflict']).nullable(),
        }),
        housingFit: z.object({
          state: z.enum(['inherit', 'none', 'applied', 'unknown']),
          method: z.string().nullable(),
          material: z.string().nullable(),
        }),
      })),
      parts: z.array(z.object({
        role: z.enum(['stem', 'bottom_housing', 'top_housing']),
        donor: z.string().min(1),
      })),
    }),
    z.object({
      ...recordBase,
      kind: z.literal('spring'),
      category: z.literal('springs'),
      manufacturer: z.string().nullable(),
      series: z.string().nullable(),
      springType: z.string().nullable(),
      actuationForce: z.string().nullable(),
      bottomOutForce: z.string().nullable(),
      length: z.string().nullable(),
    }),
    z.object({
      ...recordBase,
      kind: z.literal('lubricant'),
      category: z.literal('lubricants'),
      manufacturer: z.string().nullable(),
      series: z.string().nullable(),
      lubricantType: z.string().nullable(),
    }),
    z.object({
      ...recordBase,
      kind: z.literal('vendor'),
      category: z.literal('vendors'),
      location: z.string().nullable(),
      links: z.array(z.object({
        label: z.string().min(1),
        url: z.url(),
      })),
    }),
    z.object({
      ...recordBase,
      kind: z.literal('legacy-keycap'),
      category: z.literal('keycaps'),
      manufacturer: z.string().nullable(),
      profile: z.string().nullable(),
      manufacturingProcess: z.string().nullable(),
      stemType: z.string().nullable(),
      materials: z.array(z.string()),
      colors: z.array(z.string()),
      kits: z.array(z.string()),
    }),
  ]),
});

export const collections = { gallery, keyboards, records };
