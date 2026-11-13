/**
 * @param {Record<string, unknown>} record
 * @param {string} field
 * @returns {unknown[]}
 */
export function collectionValues(record, field) {
  if (field.includes('[].')) {
    const [parent, child] = field.split('[].', 2);
    const rows = record[parent];
    return Array.isArray(rows) ? rows.flatMap((row) => (
      row && typeof row === 'object' ? collectionValues(row, child) : []
    )) : [];
  }
  if (!field.endsWith('[]')) return [record[field]];
  const values = record[field.slice(0, -2)];
  return Array.isArray(values) ? values : [];
}

const present = (value) => value != null && (typeof value !== 'string' || value.trim() !== '');
const comparable = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(value)
  ? value.slice(0, 10) : value;
const comparison = {
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

/**
 * @typedef {{field: string, operator: string, value?: unknown}} CollectionCondition
 */

/**
 * @param {unknown} predicate
 * @returns {{mode: 'all' | 'any', conditions: CollectionCondition[]} | null}
 */
export function collectionPredicateGroup(predicate) {
  if (predicate === null || typeof predicate !== 'object' || Array.isArray(predicate)) return null;
  const keys = Object.keys(predicate);
  if (keys.length !== 1) return null;
  const mode = keys[0];
  if (mode !== 'all' && mode !== 'any') return null;
  const conditions = /** @type {{all?: CollectionCondition[], any?: CollectionCondition[]}} */ (predicate)[mode];
  return Array.isArray(conditions) ? { mode, conditions } : null;
}

/**
 * @param {Record<string, unknown>} record
 * @param {{all: CollectionCondition[]} | {any: CollectionCondition[]}} predicate
 */
export function matchesCollectionPredicate(record, predicate) {
  const group = collectionPredicateGroup(predicate);
  if (!group) throw new Error('Invalid collection predicate group.');
  if (!group.conditions.length) return true;
  /** @param {CollectionCondition} condition */
  function matches({ field, operator, value }) {
    const values = collectionValues(record, field);
    switch (operator) {
      case 'empty': return !values.some(present);
      case 'not_empty': return values.some(present);
      case 'equals': return values.some((item) => comparable(item) === value);
      case 'in': return Array.isArray(value) && values.some((item) => value.includes(comparable(item)));
      case 'contains':
        return field.endsWith('[]')
          ? values.includes(value)
          : typeof value === 'string' && values.some((item) => typeof item === 'string'
            && item.toLocaleLowerCase('ko').includes(value.toLocaleLowerCase('ko')));
      case 'year': return values.some((item) => typeof item === 'string'
        && /^\d{4}-\d{2}-\d{2}$/u.test(item) && Number(item.slice(0, 4)) === value);
      default: {
        const compare = Object.hasOwn(comparison, operator) ? comparison[operator] : undefined;
        if (!compare) throw new Error(`Unsupported collection predicate: ${operator}`);
        return values.some((item) => present(item)
          && typeof item === typeof value && compare(comparable(item), value));
      }
    }
  }
  return group.mode === 'any' ? group.conditions.some(matches) : group.conditions.every(matches);
}
