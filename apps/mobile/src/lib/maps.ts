import type { Location } from '@buddy/shared';
import { Platform } from 'react-native';

import { MAP_TILES } from '@/config';

const TILE = 256;

/** Where a point sits on the Web Mercator world map at zoom `z`, in pixels. */
export function worldPixel({ lat, lng }: Location, z: number) {
  const size = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
}

/** The map tiles that cover a width × height box centred on `center`. */
export function tilesAround(
  center: Location,
  z: number,
  width: number,
  height: number,
  template = MAP_TILES,
): Tile[] {
  const c = worldPixel(center, z);
  const x0 = c.x - width / 2;
  const y0 = c.y - height / 2;
  const count = 2 ** z;
  const tiles: Tile[] = [];
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + height) / TILE); ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + width) / TILE); tx++) {
      const x = ((tx % count) + count) % count;
      tiles.push({
        key: `${tx}/${ty}`,
        url: template
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(ty)),
        left: tx * TILE - x0,
        top: ty * TILE - y0,
        size: TILE,
      });
    }
  }
  return tiles;
}

export interface MapsApp {
  label: string;
  url: string;
}

/**
 * Apps that can give directions to a place. iPhones offer Apple Maps and
 * Google Maps (which opens in the browser if the app isn't installed);
 * Android lets the person pick from the map apps they have.
 */
export function mapsApps({ lat, lng }: Location, name: string, os = Platform.OS): MapsApp[] {
  const google = {
    label: 'Google Maps',
    url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  };
  if (os === 'ios')
    return [
      {
        label: 'Apple Maps',
        url: `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`,
      },
      google,
    ];
  if (os === 'android')
    return [
      {
        label: 'Open in Maps',
        url: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`,
      },
    ];
  return [google];
}
