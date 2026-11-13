import collectionData from '../data/collections.json';

export const recapYears = collectionData.views
  .flatMap((view) => /^recap-(\d{4})-gallery$/u.exec(view.id)?.slice(1) ?? [])
  .toSorted((left, right) => Number(right) - Number(left));
