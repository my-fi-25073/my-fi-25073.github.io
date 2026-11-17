import type { DisplayField } from './gallery-display';
import collectionData from '../data/collections.json';
import { groupsForCollectionView, matchesCollectionGroup, type CollectionManifest } from './collection-views';

export interface KeyboardRecord {
  lastBuiltAt: string | null;
  modules: string[];
  plates: string[];
  ergonomicFeatures: string[];
  layouts: string[];
  mounts: string[];
  foams: string[];
  build: {
    keycaps: Array<{
      kind: 'series' | 'kit';
      title: string;
      quantity: number | null;
      href: string;
    }>;
  };
}

function listField(key: string, label: string, values: string[]) {
  const value = values.filter((item) => item && item !== 'N/A').join(' · ');
  return value ? [{ key, label, value }] : [];
}

function dateField(value: string | null) {
  if (!value) return [];
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`)).replaceAll('. ', '/').replace('.', '');
  return [{ key: 'lastBuiltAt', label: '마지막 빌드 날짜', value: formatted }];
}

const manifest = collectionData as CollectionManifest;
const structureGroups = groupsForCollectionView(manifest, 'keyboard-structures');
const plateMaterials = new Set([
  'ABS', 'FR4', 'PC', 'PEI', 'PET', 'PLA', 'PP', 'PVC',
  '구리', '나일론', '서스', '알루미늄', '카본', '한지', '황동',
]);
const plateDesigns = new Set(['아일랜드보강', '인티보강', '스켈레톤 보강']);

function keyboardLayoutFields(layouts: string[]): DisplayField[] {
  const structures: string[] = [];
  const arrangements: string[] = [];
  for (const label of layouts) {
    const recorded = { layouts: [label] };
    if (structureGroups.some((group) => matchesCollectionGroup(recorded, group.match))) {
      structures.push(label);
    } else {
      arrangements.push(label);
    }
  }
  return [
    ...listField('structures', '구조', structures),
    ...listField('layouts', '배열', arrangements),
  ];
}

export function buildKeyboardCardFields(record: KeyboardRecord) {
  const keycaps = record.build.keycaps.map((keycap) => keycap.title).filter((title) => title && title !== 'N/A');
  return [
    ...listField('layouts', 'Layout', record.layouts),
    ...(keycaps.length ? [{ key: 'keycaps', label: 'Keycap', value: keycaps }] : []),
  ];
}

export function buildKeyboardDetailFields(record: KeyboardRecord): DisplayField[] {
  return [
    ...dateField(record.lastBuiltAt),
    ...keyboardLayoutFields(record.layouts),
    ...listField('mounts', '마운트', record.mounts.filter((label) => label !== '마운트')),
    ...listField('plateMaterials', '보강판 재질', record.plates.filter((label) => plateMaterials.has(label))),
    ...listField('plateDesigns', '보강판 형태', record.plates.filter((label) => plateDesigns.has(label))),
    ...listField('plates', '보강판', record.plates.filter(
      (label) => !plateMaterials.has(label) && !plateDesigns.has(label),
    )),
    ...listField('foams', '폼', record.foams),
    ...listField('modules', '모듈', record.modules),
    ...listField('ergonomicFeatures', '인체공학 설계', record.ergonomicFeatures),
  ];
}
