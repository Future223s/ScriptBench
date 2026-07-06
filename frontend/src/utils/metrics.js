export function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatMetric(value) {
  const number = asNumber(value);
  return number == null ? "n/a" : number.toFixed(3);
}
