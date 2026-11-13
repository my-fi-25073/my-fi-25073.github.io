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

const manufacturingProcessLabels: Record<string, string> = {
  'Double Shot': '이중사출',
  'Dye Sub': '염료승화',
  'Single Shot': '단일사출',
  '3D Print': '3D 프린팅',
};

export function keycapProfileLabel(profile: string, manufacturer?: string | null) {
  if (profile === 'Cherry-CYL') return manufacturer === 'GMK' ? 'CYL' : '체리 프로파일';
  return profile;
}

const seriesDefinitions: Record<string, FieldDefinition<SeriesRecord>> = {
  manufacturer: { label: '제조사', read: (record) => record.manufacturer },
  profile: {
    label: '프로파일',
    read: (record) => record.profile ? keycapProfileLabel(record.profile, record.manufacturer) : null,
  },
  materials: { label: '소재', read: (record) => record.materials },
  manufacturingProcess: {
    label: '제작 방식',
    read: (record) => record.manufacturingProcess
      ? manufacturingProcessLabels[record.manufacturingProcess] ?? record.manufacturingProcess
      : null,
  },
  compatibility: { label: '호환 규격', read: (record) => record.compatibility },
  colors: { label: '색상', read: (record) => record.colors },
  sleeveStatus: { label: '슬리브', read: (record) => record.sleeveStatus },
  kitCount: { label: '킷', read: (record) => `${record.kits.length}개` },
  kitNames: { label: '킷 이름', read: (record) => record.kits.map((kit) => kit.title) },
};

const kitDefinitions: Record<string, FieldDefinition<KitRecord>> = {
  kittingTypes: { label: '구성', read: (record) => record.kittingTypes },
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
