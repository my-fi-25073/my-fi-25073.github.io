export interface CollectionNavigationItem {
  id: string;
  label: string;
  href: string;
  order: number;
}

export interface CollectionCondition {
  field: string;
  operator: 'equals' | 'year';
  value: unknown;
}

export interface CollectionMatch {
  field: string;
  operator: 'equals' | 'in' | 'containsAny';
  value?: unknown;
  values?: unknown[];
}

export interface CollectionGroup {
  id: string;
  label: string;
  match: CollectionMatch;
}

export interface CollectionQuery {
  id: string;
  name: string;
  entityKind: string;
  predicate: { all: CollectionCondition[] };
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  group: { groups?: CollectionGroup[]; field?: string; unit?: string } | null;
  revision: number;
}

export interface CollectionView {
  id: string;
  queryId: string;
  name: string;
  layout: 'table' | 'gallery' | 'calendar' | 'timeline' | 'chart';
  projection: Record<string, unknown>;
  eligibility: {
    requireImages?: boolean;
    requireVariants?: boolean;
    excludeFamilyKinds?: string[];
    familyKinds?: string[];
  };
  revision: number;
}

export interface CollectionManifest {
  schemaVersion: 1;
  kind: 'collection-manifest';
  navigation: CollectionNavigationItem[];
  queries: CollectionQuery[];
  views: CollectionView[];
}

type PublicRecord = Record<string, unknown>;

function asRecord(value: object): PublicRecord {
  return value as unknown as PublicRecord;
}

function valuesForField(record: PublicRecord, field: string): unknown[] {
  const arrayMarker = '[].';
  if (field.includes(arrayMarker)) {
    const [listField, childField] = field.split(arrayMarker);
    const list = record[listField];
    if (!Array.isArray(list)) return [];
    return list.map((item) => (
      item && typeof item === 'object' ? (item as PublicRecord)[childField] : undefined
    ));
  }
  if (field.endsWith('[]')) {
    const value = record[field.slice(0, -2)];
    return Array.isArray(value) ? value : [];
  }
  return [record[field]];
}

function matchesPredicate(record: PublicRecord, predicate: CollectionQuery['predicate']) {
  return predicate.all.every((condition) => {
    const actual = record[condition.field];
    if (condition.operator === 'equals') return actual === condition.value;
    if (condition.operator === 'year') {
      return typeof actual === 'string'
        && /^\d{4}-\d{2}-\d{2}$/u.test(actual)
        && Number(actual.slice(0, 4)) === condition.value;
    }
    return false;
  });
}

function matchesEligibility(record: PublicRecord, view: CollectionView) {
  const { eligibility } = view;
  if (eligibility.requireImages) {
    if (!Array.isArray(record.images) || record.images.length === 0) return false;
  }
  if (eligibility.requireVariants) {
    if (!Array.isArray(record.variants) || record.variants.length === 0) return false;
  }
  if (eligibility.excludeFamilyKinds?.includes(String(record.familyKind))) return false;
  if (eligibility.familyKinds && !eligibility.familyKinds.includes(String(record.familyKind))) {
    return false;
  }
  return true;
}

export function matchesCollectionGroup(record: object, match: CollectionMatch) {
  const values = valuesForField(asRecord(record), match.field);
  if (match.operator === 'equals') return values.some((value) => value === match.value);
  if (match.operator === 'in') return values.some((value) => match.values?.includes(value));
  const needles = (match.values ?? []).map((value) => String(value).toLocaleLowerCase('en-US'));
  return values.some((value) => {
    const candidate = String(value ?? '').toLocaleLowerCase('en-US');
    return needles.some((needle) => candidate.includes(needle));
  });
}

export function requiredCollectionView(manifest: CollectionManifest, viewId: string) {
  const view = manifest.views.find((candidate) => candidate.id === viewId);
  if (!view) throw new Error(`Required Collection View is missing: ${viewId}`);
  const query = manifest.queries.find((candidate) => candidate.id === view.queryId);
  if (!query) throw new Error(`Required Collection Query is missing: ${view.queryId}`);
  return { view, query };
}

export function recordsForCollectionView<T extends object>(
  records: T[],
  manifest: CollectionManifest,
  viewId: string,
) {
  const { view, query } = requiredCollectionView(manifest, viewId);
  return records
    .filter((record) => (
      matchesPredicate(asRecord(record), query.predicate)
      && matchesEligibility(asRecord(record), view)
    ))
    .toSorted((left, right) => {
      const leftRecord = asRecord(left);
      const rightRecord = asRecord(right);
      for (const sort of query.sort) {
        const order = String(leftRecord[sort.field] ?? '').localeCompare(
          String(rightRecord[sort.field] ?? ''),
          'ko',
          { numeric: true, sensitivity: 'base' },
        );
        if (order !== 0) return sort.direction === 'desc' ? -order : order;
      }
      return 0;
    });
}

export function groupsForCollectionView(
  manifest: CollectionManifest,
  viewId: string,
): CollectionGroup[] {
  const { query } = requiredCollectionView(manifest, viewId);
  return query.group?.groups ?? [];
}

export function groupIdsForRecord(
  record: object,
  manifest: CollectionManifest,
  viewIds: string[],
) {
  const ids = new Set<string>();
  for (const viewId of viewIds) {
    for (const group of groupsForCollectionView(manifest, viewId)) {
      if (matchesCollectionGroup(record, group.match)) ids.add(group.id);
    }
  }
  return [...ids];
}

export function groupsWithCounts<T extends object>(
  records: T[],
  manifest: CollectionManifest,
  viewIds: string[],
) {
  const groups = viewIds.flatMap((viewId) => groupsForCollectionView(manifest, viewId));
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    count: records.filter((record) => matchesCollectionGroup(record, group.match)).length,
  })).filter((group) => group.count > 0);
}
