import { collectionValues as valuesForField, matchesCollectionPredicate } from './collection-predicate.mjs';

export interface CollectionNavigationItem {
  id: string;
  label: string;
  href: string;
  order: number;
}

export type CollectionCondition =
  | { field: string; operator: 'equals' | 'year'; value: unknown }
  | { field: string; operator: 'in'; value: Array<string | number> }
  | { field: string; operator: 'contains'; value: string }
  | { field: string; operator: 'gt' | 'gte' | 'lt' | 'lte'; value: string | number }
  | { field: string; operator: 'empty' | 'not_empty' };

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

type CollectionPredicate = { all: CollectionCondition[] } | { any: CollectionCondition[] };
type CollectionSort = Array<{ field: string; direction: 'asc' | 'desc' }>;
type CollectionValueGroup = { field: string; unit: 'value'; order: string[]; direction?: 'asc' | 'desc' };
export type KeyboardFilterPreset = {
  sort: Array<{ field: 'lastBuiltAt' | 'title' | 'firstLayout'; direction: 'asc' | 'desc' }>;
  groups: string[];
};

export interface CollectionQuery {
  id: string;
  name: string;
  entityKind: string;
  predicate: CollectionPredicate;
  sort: CollectionSort;
  group: { groups?: CollectionGroup[]; field?: string; unit?: string; order?: string[]; direction?: 'asc' | 'desc' } | null;
  revision: number;
}

export interface CollectionView {
  id: string;
  queryId: string;
  name: string;
  layout: 'table' | 'gallery' | 'calendar' | 'timeline' | 'chart';
  projection: Record<string, unknown> & {
    keyboardFilterPresets?: Record<string, KeyboardFilterPreset>;
    archive?: {
      predicate: CollectionPredicate;
      sort: CollectionSort;
      group: CollectionValueGroup | null;
    };
  };
  eligibility: {
    requireImages?: boolean;
    excludeFranken?: boolean;
    frankenOnly?: boolean;
  };
  revision: number;
}

export interface CollectionManifest {
  schemaVersion: 1;
  kind: 'collection-manifest';
  navigation: CollectionNavigationItem[];
  queries: CollectionQuery[];
  views: CollectionView[];
  copy: Record<
    | 'home.eyebrow' | 'home.title' | 'home.description'
    | 'keyboard.eyebrow' | 'keyboard.title' | 'keyboard.description'
    | 'keycap.eyebrow' | 'keycap.title' | 'keycap.description'
    | 'switch.eyebrow' | 'switch.title' | 'switch.description'
    | 'recap.eyebrow' | 'recap.title' | 'recap.description',
    string | null
  >;
}

type PublicRecord = Record<string, unknown>;

function asRecord(value: object): PublicRecord {
  return value as unknown as PublicRecord;
}

const matchesPredicate = matchesCollectionPredicate;

function matchesEligibility(record: PublicRecord, view: CollectionView) {
  const { eligibility } = view;
  if (eligibility.requireImages) {
    if (!Array.isArray(record.images) || record.images.length === 0) return false;
  }
  if (eligibility.excludeFranken && record.isFranken === true) return false;
  if (eligibility.frankenOnly && record.isFranken !== true) return false;
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

export function keycapArchiveViews(manifest: CollectionManifest) {
  const viewIds = requiredCollectionView(manifest, 'keycap-collections').view.projection.views;
  if (!Array.isArray(viewIds) || !viewIds.length || viewIds.some((id) => typeof id !== 'string')) {
    throw new Error('Keycap archive views are missing or invalid.');
  }
  return viewIds.map((viewId: string) => {
    const { view, query } = requiredCollectionView(manifest, viewId);
    return {
      view,
      query,
      id: viewId.replace(/^keycap-/, ''),
      label: view.name,
    };
  });
}

export function recordsForCollectionView<T extends object>(
  records: T[],
  manifest: CollectionManifest,
  viewId: string,
) {
  const { view, query } = requiredCollectionView(manifest, viewId);
  const archive = view.projection.archive;
  return records
    .filter((record) => (
      matchesPredicate(asRecord(record), query.predicate)
      && (!archive || matchesPredicate(asRecord(record), archive.predicate))
      && matchesEligibility(asRecord(record), view)
    ))
    .toSorted((left, right) => {
      const leftRecord = asRecord(left);
      const rightRecord = asRecord(right);
      for (const sort of archive?.sort ?? query.sort) {
        const order = valuesForField(leftRecord, sort.field).join(',').localeCompare(
          valuesForField(rightRecord, sort.field).join(','),
          'ko',
          { numeric: true, sensitivity: 'base' },
        );
        if (order !== 0) return sort.direction === 'desc' ? -order : order;
      }
      return 0;
    });
}

export function recordsGroupedByField<T extends object>(
  records: T[], field: string, order: string[], direction?: 'asc' | 'desc',
) {
  const groups = new Map<string | null, T[]>();
  for (const record of records) {
    const labels = valuesForField(asRecord(record), field)
      .filter((label): label is string => typeof label === 'string' && Boolean(label));
    for (const label of new Set(labels.length ? labels : [null])) {
      const group = groups.get(label);
      if (group) group.push(record);
      else groups.set(label, [record]);
    }
  }
  const rank = new Map<string | null, number>(order.map((label, index) => [label, index]));
  return Array.from(groups, ([label, records]) => ({ label, records })).toSorted((left, right) => {
    if (direction) {
      if (left.label === null) return 1;
      if (right.label === null) return -1;
      const result = left.label.localeCompare(right.label, 'ko', { numeric: true });
      return direction === 'desc' ? -result : result;
    }
    return (rank.get(left.label) ?? order.length) - (rank.get(right.label) ?? order.length);
  });
}

export function archiveDisplayGroups<T extends object>(
  records: T[], manifest: CollectionManifest, viewId: string,
) {
  const group = requiredCollectionView(manifest, viewId).view.projection.archive?.group;
  if (!group) return [{ label: null, records }];
  return recordsGroupedByField(records, group.field, group.order, group.direction)
    .map(({ label, records }) => ({ label: label ?? '값 없음', records }));
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
