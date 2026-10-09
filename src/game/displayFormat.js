/** Display only: preserve the original numeric values used by the simulation. */
export function temperatureText(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}°C` : '—';
}
