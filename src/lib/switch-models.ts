import type { DomainRecord } from './domain-display';

/** The database supplies family identity, representative, and generation order. */
export function switchModelFamilies(records: DomainRecord[]) {
  const families = new Map<string, DomainRecord[]>();
  for (const record of records) {
    if (!record.modelFamily) continue;
    const members = families.get(record.modelFamily.slug) ?? [];
    members.push(record);
    families.set(record.modelFamily.slug, members);
  }
  for (const [slug, members] of families) {
    if (members.filter((member) => member.modelFamily!.isRepresentative).length !== 1) {
      throw new Error(`Switch model ${slug} must have one canonical representative`);
    }
    if (new Set(members.map((member) => member.modelFamily!.title)).size !== 1) {
      throw new Error(`Switch model ${slug} has inconsistent titles`);
    }
    members.sort((a, b) => a.modelFamily!.sortOrder - b.modelFamily!.sortOrder);
  }
  return families;
}

export function switchArchiveRecords(records: DomainRecord[]) {
  const families = switchModelFamilies(records);
  const seen = new Set<string>();
  return records.flatMap((record) => {
    if (!record.modelFamily) return [record];
    const slug = record.modelFamily.slug;
    if (seen.has(slug)) return [];
    seen.add(slug);
    return [families.get(slug)!.find((member) => member.modelFamily!.isRepresentative)!];
  });
}
