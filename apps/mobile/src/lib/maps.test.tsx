import { describe, expect, it } from '@jest/globals';

import { mapsApps, tilesAround, worldPixel } from './maps';

describe('map tiles', () => {
  it('puts a point on the world map', () => {
    expect(worldPixel({ lat: 0, lng: 0 }, 1)).toEqual({ x: 256, y: 256 });
    // The standard slippy-map tile for Colombo Fort at zoom 15.
    const colombo = worldPixel({ lat: 6.9271, lng: 79.8612 }, 15);
    expect(Math.floor(colombo.x / 256)).toBe(23653);
    expect(Math.floor(colombo.y / 256)).toBe(15751);
  });

  it('covers the whole box, with the point in the middle', () => {
    const center = { lat: 6.9271, lng: 79.8612 };
    const tiles = tilesAround(center, 15, 360, 160, 'https://t/{z}/{x}/{y}.png');
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.every((t) => t.url.startsWith('https://t/15/'))).toBe(true);
    // Every pixel of the box falls inside some tile.
    for (const [x, y] of [
      [0, 0],
      [359, 0],
      [0, 159],
      [359, 159],
      [180, 80],
    ] as const) {
      expect(
        tiles.some((t) => x >= t.left && x < t.left + t.size && y >= t.top && y < t.top + t.size),
      ).toBe(true);
    }
  });
});

describe('directions', () => {
  const at = { lat: 6.9, lng: 79.86 };
  it('offers Apple and Google Maps on iPhone', () => {
    const apps = mapsApps(at, 'Galle Face Green', 'ios');
    expect(apps.map((a) => a.label)).toEqual(['Apple Maps', 'Google Maps']);
    expect(apps[0]!.url).toBe('https://maps.apple.com/?ll=6.9,79.86&q=Galle%20Face%20Green');
  });
  it('lets Android pick a map app', () => {
    expect(mapsApps(at, 'Galle Face', 'android')[0]!.url).toBe(
      'geo:6.9,79.86?q=6.9,79.86(Galle%20Face)',
    );
  });
});
