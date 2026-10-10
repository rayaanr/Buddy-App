import type { Venue } from '@buddy/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useVenueSearch } from '@/api/queries';
import { LocateIcon, MapPinIcon, TextField } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { currentPoint } from '@/lib/location';
import { useDiscoverStore } from '@/store/discover';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

/** The exact meeting point, and how to describe it under the field. */
export interface Pin {
  lat: number;
  lng: number;
  label: string;
}

interface VenueFieldProps {
  where: string;
  pin: Pin | null;
  onChange: (where: string, pin: Pin | null) => void;
  /** Shown when there's no pin: where the activity will be placed instead. */
  fallback: string;
}

/**
 * "Where": type a venue and pick a suggestion (OpenStreetMap or Google,
 * depending on the API's setting), or pin where you are. Either sets the
 * exact meeting point; the typed name is what people see.
 */
export function VenueField({ where, pin, onChange, fallback }: VenueFieldProps) {
  // Suggestions show while typing, and hide once one is picked.
  const [typing, setTyping] = useState(false);
  const here = useDiscoverStore((s) => s.here);
  const query = useDebounced(where.trim());
  const venues = useVenueSearch(typing ? query : '', pin ?? here);
  const [locating, setLocating] = useState(false);

  const pick = (v: Venue) => {
    setTyping(false);
    onChange(v.name, { ...v.location, label: v.address || v.name });
  };

  const pinHere = async () => {
    setLocating(true);
    try {
      const point = await currentPoint(true);
      useDiscoverStore.getState().setHere(point);
      onChange(where, { ...point, label: 'Where you are now' });
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const suggestions = typing && query.length >= 2 ? (venues.data?.venues ?? []).slice(0, 5) : [];

  return (
    <View>
      <TextField
        value={where}
        onChangeText={(text) => {
          setTyping(true);
          // Typing a different name keeps the pin; picking a suggestion moves it.
          onChange(text, pin);
        }}
        placeholder="Venue, park or address"
        size="md"
        accessibilityLabel="Where"
      />
      {suggestions.length ? (
        <View className="mt-1.5 overflow-hidden rounded-2xl bg-surface">
          {suggestions.map((v, i) => (
            <Pressable
              key={`${v.name}-${v.location.lat}-${v.location.lng}`}
              onPress={() => pick(v)}
              accessibilityRole="button"
              accessibilityLabel={`${v.name}, ${v.address}`}
              className={`flex-row items-center gap-3 px-4 py-3 active:bg-surface-raised ${i ? 'border-t border-divider' : ''}`}
            >
              <MapPinIcon />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-sans-medium text-[15px] text-ink">
                  {v.name}
                </Text>
                {v.address ? (
                  <Text numberOfLines={1} className="mt-0.5 font-sans text-[13px] text-muted">
                    {v.address}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {venues.data?.attribution ? (
            <Text className="border-t border-divider px-4 py-2 text-right font-sans text-[11.5px] text-subtle">
              {venues.data.attribution}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="mt-2 flex-row items-center gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
          <MapPinIcon size={14} color={pin ? colors.lime : colors.subtle} />
          <Text
            numberOfLines={2}
            className="shrink font-sans text-[13px] leading-[18px] text-muted"
          >
            {pin ? `Pinned: ${pin.label}` : `Not pinned yet, so it’ll show in ${fallback}.`}
          </Text>
        </View>
        <Pressable
          onPress={locating ? undefined : () => void pinHere()}
          accessibilityRole="button"
          hitSlop={8}
          className="flex-row items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 active:opacity-70"
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.lime} />
          ) : (
            <LocateIcon size={14} />
          )}
          <Text className="font-sans-medium text-[13px] text-ink">
            {locating ? 'Finding you…' : 'Use where I am'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
