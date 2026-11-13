import type { CollectionEntry } from 'astro:content';
import type { DisplayField } from './gallery-display';

export type DomainRecord = CollectionEntry<'records'>['data'];

function textField(key: string, label: string, value: string | null | undefined) {
  return value?.trim() ? [{ key, label, value: value.trim() }] : [];
}

function listField(key: string, label: string, values: string[]) {
  const value = values.filter(Boolean).join(' · ');
  return value ? [{ key, label, value }] : [];
}

export function buildDomainFields(record: DomainRecord, compact = false): DisplayField[] {
  const fields = [
    ...textField('manufacturer', 'Manufacturer', record.manufacturer),
    ...textField('footprintType', 'Footprint', record.footprintType === 'None' ? null : record.footprintType),
    ...listField('switchTypes', 'Type', record.switchTypes),
  ];
  return compact
    ? fields.filter((field) => field.key !== 'manufacturer').slice(0, 2)
    : fields;
}

export function domainSearchText(record: DomainRecord) {
  return [
    record.title,
    record.modelFamily?.title ?? '',
    record.manufacturer ?? '',
    record.footprintType ?? '',
    ...record.switchTypes,
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
