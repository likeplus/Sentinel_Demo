/** Geometry-only helpers. Map rendering never needs a simulation checkpoint. */
export function polygonPoints(unit) {
  const points = unit.geometry?.coordinates;
  return Array.isArray(points) && points.length >= 3
    && points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    ? points : [];
}

export function geometryBounds(units, padding = 0) {
  const points = units.flatMap(polygonPoints);
  if (!points.length) return { x: 0, y: 0, width: 100, height: 100 };
  const x = Math.min(...points.map(point => point[0]));
  const y = Math.min(...points.map(point => point[1]));
  const width = Math.max(...points.map(point => point[0])) - x;
  const height = Math.max(...points.map(point => point[1])) - y;
  return { x: x - padding, y: y - padding, width: Math.max(1, width) + padding * 2, height: Math.max(1, height) + padding * 2 };
}

export function geometryCenter(unit) {
  if (Array.isArray(unit.centroid) && unit.centroid.length === 2 && unit.centroid.every(Number.isFinite)) return unit.centroid;
  const bounds = geometryBounds([unit]);
  return [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
}

export function groupMapClusters(units) {
  const groups = new Map();
  units.forEach(unit => {
    const id = unit.clusterId || 'unassigned';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(unit);
  });
  return [...groups].map(([id, members]) => ({ id, units: members, bounds: geometryBounds(members) }));
}
