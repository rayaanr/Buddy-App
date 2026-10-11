import type { Place } from '@buddy/shared';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { nearestPlace, usePlaceSearch } from '@/api/queries';
import { LocateIcon, MapPinIcon, Dialog, TextField } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { useLocate } from '@/hooks/useLocate';
import { colors } from '@/theme';

/** "Kandy District", or "Cinnamon Gardens · Colombo" for places with another name. */
const subtitle = (p: Place) => (p.aka ? `${p.aka} · ${p.district}` : `${p.district} District`);

interface PlaceSearchProps {
  onPick: (place: Place) => void;
  autoFocus?: boolean;
  /** Rows shown above the results (e.g. Discover's "Near me" and "Home"). */
  children?: ReactNode;
  /** Offer "Use my current location" (Discover has its own "Near me" instead). */
  currentLocation?: boolean;
}

/**
 * Find a town anywhere in Sri Lanka by typing (close spellings work), or
 * from the phone's location. Location permission is only asked for when
 * "Use my current location" is tapped.
 */
export function PlaceSearch({
  onPick,
  autoFocus,
  children,
  currentLocation = true,
}: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  // One request once typing pauses, not one per keystroke.
  const results = usePlaceSearch(useDebounced(query, 250));
  const typed = query.trim().length > 0;
  const { locating, locate: pickCurrent } = useLocate(async (point) =>
    onPick(await nearestPlace(point)),
  );

  return (
    <View>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search towns, e.g. Kandy"
        tone="inset"
        size="md"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="search"
        accessibilityLabel="Search towns"
      />
      {typed ? null : (
        <>
          {children}
          {currentLocation ? (
            <PlaceRow
              icon={locating ? <ActivityIndicator color={colors.lime} /> : <LocateIcon />}
              label={locating ? 'Finding you…' : 'Use my current location'}
              onPress={locating ? undefined : pickCurrent}
              accent
            />
          ) : null}
        </>
      )}
      {typed
        ? results.data?.map((p) => (
            <PlaceRow
              key={p.id}
              icon={<MapPinIcon />}
              label={p.name}
              sub={subtitle(p)}
              onPress={() => onPick(p)}
            />
          ))
        : null}
      {typed && results.data?.length === 0 ? (
        <Text className="py-4 font-sans text-[14.5px] text-muted">
          No towns match “{query.trim()}”. Try a nearby town.
        </Text>
      ) : null}
    </View>
  );
}

export function PlaceRow({
  icon,
  label,
  sub,
  onPress,
  accent,
  selected,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  accent?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-3 border-b border-divider py-3.5 active:opacity-70"
    >
      <View className="w-6 items-center">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className={
            accent
              ? 'font-sans-medium text-[15.5px] text-lime'
              : 'font-sans-medium text-[15.5px] text-ink'
          }
        >
          {label}
        </Text>
        {sub ? (
          <Text numberOfLines={1} className="mt-0.5 font-sans text-[13px] text-muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {selected ? <Text className="font-sans-medium text-[13px] text-lime">Selected</Text> : null}
    </Pressable>
  );
}

/** A dialog for choosing a town: Sign up and Edit profile ("Where do you live?"). */
export function PlacePickerSheet({
  open,
  onClose,
  onPick,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (place: Place) => void;
  title: string;
}) {
  return (
    <Dialog position="top" open={open} onClose={onClose}>
      <View className="px-[22px]">
        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">{title}</Text>
        <PlaceSearch
          autoFocus
          onPick={(p) => {
            onPick(p);
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}
