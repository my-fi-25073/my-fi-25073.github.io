/** @param {number} centinewtons */
export function gramsFromCentinewtons(centinewtons) {
  return Number((centinewtons / 0.980665).toFixed(1));
}

const number = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const centinewtonText = new RegExp(
  `(${number})(?:\\s*([±–—-])\\s*(${number}))?\\s*cN\\b`,
  'giu',
);

/** @param {string} text */
export function formatPressureInGrams(text) {
  return text.replace(centinewtonText, (_match, first, separator, second) => {
    const nominal = `${gramsFromCentinewtons(Number(first))}g`;
    return separator ? `${nominal} ${separator} ${gramsFromCentinewtons(Number(second))}g` : nominal;
  });
}
