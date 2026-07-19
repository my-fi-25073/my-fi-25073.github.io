import type { CollectionEntry } from 'astro:content';
import type { DisplayField } from './gallery-display';

export type DomainRecord = CollectionEntry<'records'>['data'];

const labels = {
  switch: { singular: 'Switch', korean: '스위치', archive: '스위치 아카이브' },
  spring: { singular: 'Spring', korean: '스프링', archive: '스프링 아카이브' },
  lubricant: { singular: 'Lubricant', korean: '윤활제', archive: '윤활제 아카이브' },
  vendor: { singular: 'Vendor', korean: '벤더', archive: '벤더 아카이브' },
  'legacy-keycap': { singular: 'Keycap DB', korean: '기존 키캡', archive: '키캡 아카이브' },
} as const;

function textField(key: string, label: string, value: string | null | undefined) {
  return value?.trim() ? [{ key, label, value: value.trim() }] : [];
}

function listField(key: string, label: string, values: string[]) {
  const value = values.filter(Boolean).join(' · ');
  return value ? [{ key, label, value }] : [];
}

export function domainLabels(record: DomainRecord) {
  return labels[record.kind];
}

export function buildDomainFields(record: DomainRecord, compact = false): DisplayField[] {
  if (record.kind === 'switch') {
    const fields = [
      ...textField('manufacturer', '제조사', record.manufacturer),
      ...listField('switchTypes', '타입', record.switchTypes),
      ...textField('footprintType', '풋프린트', record.footprintType),
      ...textField('rating', '평가', record.rating),
      ...textField('film', '필름', record.film),
    ];
    return compact ? fields.slice(0, 3) : fields;
  }
  if (record.kind === 'spring') {
    const fields = [
      ...textField('manufacturer', '제조사', record.manufacturer),
      ...textField('series', '시리즈', record.series),
      ...textField('springType', '타입', record.springType),
      ...textField('actuationForce', '입력압', record.actuationForce),
      ...textField('bottomOutForce', '바닥압', record.bottomOutForce),
      ...textField('length', '길이', record.length),
    ];
    return compact ? fields.filter((field) => ['manufacturer', 'bottomOutForce', 'length'].includes(field.key)) : fields;
  }
  if (record.kind === 'lubricant') {
    return [
      ...textField('manufacturer', '제조사', record.manufacturer),
      ...textField('series', '시리즈', record.series),
      ...textField('lubricantType', '타입', record.lubricantType),
    ];
  }
  if (record.kind === 'legacy-keycap') {
    const fields = [
      ...textField('manufacturer', '제조사', record.manufacturer),
      ...textField('profile', '프로파일', record.profile),
      ...textField('manufacturingProcess', '가공', record.manufacturingProcess),
      ...textField('stemType', '스템', record.stemType),
      ...listField('materials', '소재', record.materials),
      ...listField('colors', '컬러', record.colors),
      ...(record.kits.length > 0 ? [{ key: 'kits', label: '킷', value: `${record.kits.length}개` }] : []),
    ];
    return compact ? fields.slice(0, 3) : fields;
  }
  return [
    ...textField('location', '위치', record.location),
    ...(record.links[0] ? [{ key: 'website', label: '웹사이트', value: new URL(record.links[0].url).hostname }] : []),
  ];
}

export function domainSummary(record: DomainRecord) {
  const label = domainLabels(record).korean;
  if (record.kind === 'vendor') return `${record.title}의 위치와 공식 링크를 정리한 벤더 기록입니다.`;
  if (record.kind === 'legacy-keycap') return `${record.title}의 기존 Keycap DB 속성을 보존한 키캡 기록입니다.`;
  return `${record.title}의 주요 속성과 이미지를 정리한 ${label} 기록입니다.`;
}

export function domainSearchText(record: DomainRecord) {
  return [record.title, domainLabels(record).korean, ...buildDomainFields(record).map((field) => field.value)]
    .join(' ')
    .toLocaleLowerCase('ko');
}
