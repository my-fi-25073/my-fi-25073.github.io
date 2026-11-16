import type { DomainRecord } from './domain-display';
import type { DisplayField } from './gallery-display';
import { formatPressureInGrams } from './force-display.mjs';
import { publicSwitchTuningRoute } from './switch-tuning-route.mjs';

export type SwitchTuning = DomainRecord['tunings'][number];

export function switchCoverImage({ images, coverImageIndex }: DomainRecord | SwitchTuning) {
  return coverImageIndex === null ? undefined : images[coverImageIndex ?? 0];
}

// Published image names start with the product digest followed by the media owner's digest.
const tuningOwnerDigest = /\/[a-f0-9]{16}-([a-f0-9]{12})-/u;

function tuningLabel(tuning: SwitchTuning) {
  if (tuning.isStock !== undefined) return tuning.label;
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

const springSpecLabels = {
  initial_force: 'Initial force',
  actuation_force: 'Actuation',
  tactile_force: 'Tactile peak',
  bottom_out_force: 'Bottom-out',
  final_force: 'Final force',
  length: 'Length',
  spring_stage: 'Stages',
};

function lubricationText(item: SwitchTuning['lubrication']['stem']) {
  if (item.state === 'factory') return 'Factory Lube';
  if (item.state === 'none') return 'No-Lube';
  if (item.state === 'applied') return item.name ?? '';
  return '';
}

export function buildSwitchTuningFields(tuning: SwitchTuning): DisplayField[] {
  const fields: DisplayField[] = [];
  const specs = tuning.switchSpecifications;
  if (specs?.actuationForce) fields.push({ key: 'switchActuationForce', label: 'Actuation', value: specs.actuationForce });
  if (specs?.actuationTravel) fields.push({ key: 'actuationTravel', label: 'Pre-travel', value: specs.actuationTravel });
  if (specs?.totalTravel) fields.push({ key: 'totalTravel', label: 'Total travel', value: specs.totalTravel });
  if (specs?.springLength) fields.push({ key: 'springLength', label: 'Length', value: specs.springLength });
  if (specs?.durabilityCycles) {
    fields.push({ key: 'durabilityCycles', label: 'Lifespan', value: `${specs.durabilityCycles.toLocaleString('en-US')} cycles` });
  }
  if (specs?.factoryLubed !== undefined) {
    fields.push({ key: 'factoryLubed', label: 'Factory lubrication', value: specs.factoryLubed ? 'Factory Lube' : 'No-Lube' });
  }
  const unresolvedSpring = tuning.spring.resolution === 'stock_unresolved';
  if (tuning.spring.resolution === 'selected' && tuning.spring.name) {
    fields.push({ key: 'spring', label: 'Spring', value: tuning.spring.name });
  }

  const springSpecs = Object.entries(tuning.spring.specifications ?? {}) as
    [keyof typeof springSpecLabels, string][];
  for (const [key, value] of springSpecs) {
    const isPressure = key.endsWith('_force');
    const scope = unresolvedSpring && isPressure ? 'Stock ' : '';
    const display = isPressure ? formatPressureInGrams(value) : value;
    fields.push({
      key,
      label: scope + springSpecLabels[key],
      value: display,
    });
  }

  const stemLube = lubricationText(tuning.lubrication.stem);
  const springLube = lubricationText(tuning.lubrication.spring);
  if (stemLube && stemLube === springLube) {
    fields.push({ key: 'lubrication', label: 'Stem / Spring lube', value: stemLube });
  } else {
    if (stemLube) fields.push({ key: 'stemLubrication', label: 'Stem', value: stemLube });
    if (springLube) fields.push({ key: 'springLubrication', label: 'Spring lube', value: springLube });
  }

  return fields;
}
