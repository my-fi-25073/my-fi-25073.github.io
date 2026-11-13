import type { CollectionEntry } from 'astro:content';
import type { DisplayField } from './gallery-display';

export type DomainRecord = CollectionEntry<'records'>['data'];

const switchTypeLabels = new Map([
  ['Linear', '리니어'],
  ['Tactile', '택타일'],
  ['Click', '클릭'],
]);

function displaySwitchTypes(types: string[]) {
  const silent = types.includes('Silent');
  const movements = types.filter((type) => type !== 'Silent');
  if (silent && movements.length === 1 && switchTypeLabels.has(movements[0])) {
    return [`저소음 ${switchTypeLabels.get(movements[0])}`];
  }
  return types.map((type) => type === 'Silent' ? '저소음' : (switchTypeLabels.get(type) ?? type));
}

function textField(key: string, label: string, value: string | null | undefined) {
  return value?.trim() ? [{ key, label, value: value.trim() }] : [];
}

function listField(key: string, label: string, values: string[]) {
  const value = values.filter(Boolean).join(' · ');
  return value ? [{ key, label, value }] : [];
}

export function buildDomainFields(record: DomainRecord, compact = false): DisplayField[] {
  const fields = [
    ...textField('manufacturer', '제조사', record.manufacturer),
    ...textField('footprintType', '규격', record.footprintType === 'None' ? null : record.footprintType),
    ...listField('switchTypes', '타입', displaySwitchTypes(record.switchTypes)),
  ];
  return compact
    ? fields.filter((field) => field.key !== 'manufacturer').slice(0, 2)
    : fields;
}

export function domainSearchText(record: DomainRecord) {
  return [
    record.title,
    record.manufacturer ?? '',
    record.footprintType ?? '',
    ...record.switchTypes,
    ...displaySwitchTypes(record.switchTypes),
    ...record.tunings.flatMap((tuning) => [
      tuning.label,
      tuning.spring.name ?? '',
      tuning.lubrication.stem.name ?? '',
      tuning.lubrication.spring.name ?? '',
      tuning.housingFit.method ?? '',
      tuning.housingFit.material ?? '',
    ]),
    ...record.parts.map((part) => part.donor),
  ].join(' ').toLocaleLowerCase('ko');
}
