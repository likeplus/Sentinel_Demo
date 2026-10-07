import { describe, expect, it } from 'vitest';
import { geometryBounds, geometryCenter, groupMapClusters, polygonPoints } from '../src/game/mapGeometry.js';

const smallFixture = [
  { id: 'NORTH', clusterId: 'one', geometry: { coordinates: [[-25, -10], [15, -10], [15, 20], [-25, 20]] } },
  { id: 'SOUTH', clusterId: 'two', geometry: { coordinates: [[40, 60], [70, 60], [75, 85], [40, 90]] }, centroid: [55, 75] },
  { id: 'WEST', clusterId: 'one', geometry: { coordinates: [[-60, 0], [-40, 0], [-50, 20]] } },
];

describe('farm map adapts to content geometry', () => {
  it('frames negative coordinates and a non-grid fixture without assuming twelve units', () => {
    expect(geometryBounds(smallFixture, 5)).toEqual({ x: -65, y: -15, width: 145, height: 110 });
    const clusters = groupMapClusters(smallFixture);
    expect(clusters.map(cluster => [cluster.id, cluster.units.length])).toEqual([['one', 2], ['two', 1]]);
    expect(clusters[0].bounds).toEqual({ x: -60, y: -10, width: 75, height: 30 });
  });

  it('uses configured centroids and excludes malformed or missing geometry', () => {
    expect(geometryCenter(smallFixture[1])).toEqual([55, 75]);
    expect(geometryCenter(smallFixture[0])).toEqual([-5, 5]);
    expect(polygonPoints({ geometry: { coordinates: [[0, 0], [NaN, 3], [5, 5]] } })).toEqual([]);
    expect(geometryBounds([{ id: 'no-map' }])).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
