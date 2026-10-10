import * as Location from 'expo-location';

import { ApiRequestError } from '@/api/client';

export interface Point {
  lat: number;
  lng: number;
}

/**
 * Where the phone is now. Asks for permission the first time (only ever when
 * someone taps something like "Near me"), and throws a friendly error if it's
 * refused or location is off. Town-level accuracy is plenty for Discover;
 * pinning a meeting point asks for more.
 */
export async function currentPoint(precise = false): Promise<Point> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new ApiRequestError(
      0,
      'location_denied',
      permission.canAskAgain
        ? 'Allow location to use this.'
        : 'Location is off for Buddy. Turn it on in Settings to use this.',
    );
  }
  try {
    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
    });
    return { lat: coords.latitude, lng: coords.longitude };
  } catch {
    throw new ApiRequestError(
      0,
      'location_unavailable',
      'Couldn’t find your location. Try again outside or with Wi-Fi on.',
    );
  }
}

/** Where the phone is, without asking: only if permission was already given. */
export async function currentPointIfAllowed(): Promise<Point | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  try {
    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: coords.latitude, lng: coords.longitude };
  } catch {
    return null;
  }
}
