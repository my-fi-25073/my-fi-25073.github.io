import config from '../config/gallery-display.json';

export interface DisplayField {
  key: string;
  label: string;
  value: string;
}

interface SeriesRecord {
  manufacturer: string | null;
  profile: string | null;
  manufacturingProcess: string | null;
  sleeveStatus: string | null;
  materials: string[];
  colors: string[];
  compatibility: string[];
  kits: Array<{ title: string }>;
}

interface KitRecord {
  kittingTypes: string[];
}

interface FieldDefinition<T> {
  label: string;
  read: (record: T) => string | string[] | null;
}

const seriesDefinitions: Record<string, FieldDefinition<SeriesRecord>> = {
  manufacturer: { label: 'Manufacturer', read: (record) => record.manufacturer },
  profile: {
    label: 'Profile',
    read: (record) => record.profile,
  },
  materials: { label: 'Material', read: (record) => record.materials },
  manufacturingProcess: {
    label: 'Process',
    read: (record) => record.manufacturingProcess,
  },
  compatibility: { label: 'Compatibility', read: (record) => record.compatibility },
  colors: { label: 'Color', read: (record) => record.colors },
  sleeveStatus: { label: 'Sleeve', read: (record) => record.sleeveStatus },
  kitCount: { label: 'Kits', read: (record) => String(record.kits.length) },
  kitNames: { label: 'Kits', read: (record) => record.kits.map((kit) => kit.title) },
};

const kitDefinitions: Record<string, FieldDefinition<KitRecord>> = {
  kittingTypes: { label: 'Kitting', read: (record) => record.kittingTypes },
};

function validateKeys<T>(
  keys: unknown,
  definitions: Record<string, FieldDefinition<T>>,
  location: string,
  maximum: number,
) {
  if (!Array.isArray(keys) || !keys.every((key) => typeof key === 'string')) {
    throw new Error(`gallery-display.json ${location} must be a string array.`);
  }
  const seen = new Set<string>();
  if (keys.length > maximum) {
    throw new Error(`gallery-display.json ${location} accepts at most ${maximum} fields.`);
  }
  for (const key of keys) {
    if (!(key in definitions)) {
      throw new Error(
        `Unknown gallery display field "${key}" in ${location}. `
          + `Allowed: ${Object.keys(definitions).join(', ')}`,
      );
    }
    if (seen.has(key)) throw new Error(`Duplicate gallery display field "${key}" in ${location}.`);
    seen.add(key);
  }
  return keys;
}

export const galleryDisplay = {
  homeCard: validateKeys(config.homeCard, seriesDefinitions, 'homeCard', 3),
  seriesDetail: validateKeys(config.seriesDetail, seriesDefinitions, 'seriesDetail', 10),
  kitCard: validateKeys(config.kitCard, kitDefinitions, 'kitCard', 2),
};

function buildFields<T>(
  record: T,
  keys: readonly string[],
  definitions: Record<string, FieldDefinition<T>>,
) {
  return keys.flatMap((key): DisplayField[] => {
    const definition = definitions[key];
    const raw = definition.read(record);
    const value = Array.isArray(raw) ? raw.filter(Boolean).join(' · ') : raw?.trim();
    return value ? [{ key, label: definition.label, value }] : [];
  });
}

export function buildSeriesFields(record: SeriesRecord, keys: readonly string[]) {
  return buildFields(record, keys, seriesDefinitions);
}

export function buildKitFields(record: KitRecord, keys: readonly string[]) {
  return buildFields(record, keys, kitDefinitions);
}
