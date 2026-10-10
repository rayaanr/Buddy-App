import { customType } from 'drizzle-orm/pg-core';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Parses a PostGIS point from hex EWKB, the format Postgres returns for
 * geography/geometry columns: byte order, type (with SRID flag), SRID, x, y.
 */
function parsePointEwkb(hex: string): LatLng {
  const buf = Buffer.from(hex, 'hex');
  const little = buf.readUInt8(0) === 1;
  const type = little ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) !== 0;
  let offset = 5 + (hasSrid ? 4 : 0);
  const read = () => {
    const v = little ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    offset += 8;
    return v;
  };
  const lng = read();
  const lat = read();
  return { lat, lng };
}

/**
 * WGS 84 point stored as `geography(Point, 4326)`. Distances and ST_DWithin
 * on geography work in metres, and the column carries its SRID explicitly
 * (Drizzle's built-in geometry column drops it).
 *
 * drizzle-kit quotes parameterised custom types in generated SQL
 * ("geography(Point,4326)"), which Postgres rejects. When a generated migration
 * adds a column of this type, remove those quotes by hand.
 */
export const geographyPoint = customType<{ data: LatLng; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
  toDriver: ({ lat, lng }) => `SRID=4326;POINT(${lng} ${lat})`,
  fromDriver: (value) => parsePointEwkb(value),
});
