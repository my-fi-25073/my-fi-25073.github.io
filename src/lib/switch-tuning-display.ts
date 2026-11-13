import type { DomainRecord } from './domain-display';
import type { DisplayField } from './gallery-display';
import { formatPressureInGrams } from './force-display.mjs';
import { publicSwitchTuningRoute } from './switch-tuning-route.mjs';

export type SwitchTuning = DomainRecord['tunings'][number];

// Published image names start with the product digest followed by the media owner's digest.
const tuningOwnerDigest = /\/[a-f0-9]{16}-([a-f0-9]{12})-/u;

function tuningLabel(tuning: SwitchTuning) {
  const [first, ...rest] = tuning.label.split(' · ');
  if (tuning.spring.resolution === 'stock_unresolved' && first === tuning.spring.name && rest.length) {
    return rest.join(' · ');
  }
  return tuning.label;
}

export function publicSwitchTunings(record: DomainRecord) {
  const keys = new Set<string>();
  return record.tunings.map((tuning, index) => {
    const sources = tuning.images.flatMap((image) => image.variants.map(({ src }) => src));
    const ownerDigest = sources.length ? tuningOwnerDigest.exec(sources[0])?.[1] : null;
    if (sources.length && (!ownerDigest || sources.some((src) => tuningOwnerDigest.exec(src)?.[1] !== ownerDigest))) {
      throw new Error(`Invalid public Switch tuning identity: ${record.slug}, entry ${index + 1}`);
    }
    const { key, href } = publicSwitchTuningRoute(record.slug, index + 1, ownerDigest ?? null);
    if (keys.has(key)) throw new Error(`Duplicate public Switch tuning identity: ${href}`);
    keys.add(key);
    return {
      key,
      label: tuningLabel(tuning),
      href,
      tuning,
    };
  });
}

const housingMethodLabels: Record<string, string> = {
  film: '필름',
  glue_marker: '글루 마커',
  cyanoacrylate: '순간접착제',
  other: '기타',
};
const springSpecLabels = {
  initial_force: '초기압',
  actuation_force: '입력압',
  tactile_force: '걸림압',
  bottom_out_force: '바닥압',
  final_force: '최종압',
  length: '스프링 길이',
  spring_stage: '스프링 단수',
};
const springStageLabels = new Map([
  ['single-stage', '1단'],
  ['dual-stage', '2단'],
  ['triple-stage', '3단'],
]);

function lubricationText(item: SwitchTuning['lubrication']['stem']) {
  if (item.state === 'factory') return '공장 윤활';
  if (item.state === 'none') return '무윤활';
  if (item.state === 'applied') return item.name ?? '';
  return '';
}

export function buildSwitchTuningFields(tuning: SwitchTuning): DisplayField[] {
  const fields: DisplayField[] = [];
  const unresolvedSpring = tuning.spring.resolution === 'stock_unresolved';
  if (tuning.spring.resolution === 'selected' && tuning.spring.name) {
    fields.push({ key: 'spring', label: '스프링', value: tuning.spring.name });
  }

  const springSpecs = Object.entries(tuning.spring.specifications ?? {}) as
    [keyof typeof springSpecLabels, string][];
  for (const [key, value] of springSpecs) {
    const isPressure = key.endsWith('_force');
    const scope = unresolvedSpring && isPressure ? '순정 스위치 ' : '';
    const display = isPressure ? formatPressureInGrams(value)
      : key === 'spring_stage' ? (springStageLabels.get(value) ?? value) : value;
    fields.push({
      key,
      label: scope + springSpecLabels[key],
      value: display,
    });
  }

  const stemLube = lubricationText(tuning.lubrication.stem);
  const springLube = lubricationText(tuning.lubrication.spring);
  if (stemLube && stemLube === springLube) {
    fields.push({ key: 'lubrication', label: '윤활', value: stemLube });
  } else {
    if (stemLube) fields.push({ key: 'stemLubrication', label: '스템 윤활', value: stemLube });
    if (springLube) fields.push({ key: 'springLubrication', label: '스프링 윤활', value: springLube });
  }

  const { state, method, material } = tuning.housingFit;
  if (state === 'applied') {
    const housingMethod = method && (housingMethodLabels[method] ?? method);
    const value = material ?? housingMethod;
    if (value) {
      const label = material && housingMethod && method !== 'other' ? housingMethod : '하우징';
      fields.push({ key: 'housingFit', label, value });
    }
  }
  return fields;
}
