import type { DisplayField } from './gallery-display';

export interface KeyboardRecord {
  status: string | null;
  lastBuiltAt: string | null;
  modules: string[];
  plates: string[];
  ergonomicFeatures: string[];
  layouts: string[];
  mounts: string[];
  foams: string[];
}

function textField(key: string, label: string, value: string | null | undefined) {
  return value?.trim() ? [{ key, label, value: value.trim() }] : [];
}

function listField(key: string, label: string, values: string[]) {
  const value = values.filter(Boolean).join(' · ');
  return value ? [{ key, label, value }] : [];
}

function dateField(value: string | null) {
  if (!value) return [];
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`)).replaceAll('. ', '/').replace('.', '');
  return [{ key: 'lastBuiltAt', label: '최근 빌드', value: formatted }];
}

export function buildKeyboardCardFields(record: KeyboardRecord): DisplayField[] {
  return [
    ...listField('layouts', '배열', record.layouts),
    ...listField('plates', '보강판', record.plates),
    ...dateField(record.lastBuiltAt),
  ];
}

export function buildKeyboardDetailFields(record: KeyboardRecord): DisplayField[] {
  return [
    ...textField('status', '상태', record.status),
    ...dateField(record.lastBuiltAt),
    ...listField('layouts', '배열', record.layouts),
    ...listField('mounts', '결합 방식', record.mounts),
    ...listField('plates', '보강판', record.plates),
    ...listField('foams', '폼', record.foams),
    ...listField('modules', '모듈', record.modules),
    ...listField('ergonomicFeatures', '어고노믹', record.ergonomicFeatures),
  ];
}
