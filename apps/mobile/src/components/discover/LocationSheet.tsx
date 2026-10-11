import { DISCOVER_RADII, placeLabel } from '@buddy/shared';
import { ActivityIndicator, Text, View } from 'react-native';

import { PlaceRow, PlaceSearch } from '@/components/places/PlaceSearch';
import { Chip, LocateIcon, MapPinIcon, SectionLabel, Dialog } from '@/components/ui';
import { useLocate } from '@/hooks/useLocate';
import { useDiscoverStore } from '@/store/discover';
import { colors } from '@/theme';

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  /** Home town as shown, e.g. "Peradeniya, Kandy". */
  home: string;
}

/**
 * Discover's "where": near me (asks for location only when tapped), home, or
 * any town (handy before a trip), plus how far to look.
 */
export function LocationSheet({ open, onClose, home }: LocationSheetProps) {
  const origin = useDiscoverStore((s) => s.origin);
  const radiusKm = useDiscoverStore((s) => s.radiusKm);
  const { setOrigin, setRadius, setHere } = useDiscoverStore.getState();
  const { locating, locate: nearMe } = useLocate((point) => {
    setHere(point);
    setOrigin({ kind: 'here' });
    onClose();
  });

  return (
    <Dialog position="top" open={open} onClose={onClose}>
      <View className="px-[22px]">
        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Show activities near</Text>
        <PlaceSearch
          currentLocation={false}
          onPick={(p) => {
            setOrigin({ kind: 'town', id: p.id, label: placeLabel(p) });
            onClose();
          }}
        >
          <PlaceRow
            icon={locating ? <ActivityIndicator color={colors.lime} /> : <LocateIcon />}
            label={locating ? 'Finding you…' : 'Near me'}
            sub="Where you are right now"
            onPress={locating ? undefined : nearMe}
            selected={origin.kind === 'here'}
            accent
          />
          <PlaceRow
            icon={<MapPinIcon />}
            label={home}
            sub="Home"
            onPress={() => {
              setOrigin({ kind: 'home' });
              onClose();
            }}
            selected={origin.kind === 'home'}
          />
          {origin.kind === 'town' ? (
            <PlaceRow icon={<MapPinIcon />} label={origin.label} sub="Browsing" selected />
          ) : null}
        </PlaceSearch>

        <SectionLabel className="mb-2.5 mt-5">How far</SectionLabel>
        <View className="flex-row gap-2">
          {DISCOVER_RADII.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={km === radiusKm}
              onPress={() => setRadius(km)}
            />
          ))}
        </View>
        <Text className="mt-2.5 font-sans text-[13px] leading-[18px] text-muted">
          If there’s nothing that close, Discover looks further and tells you.
        </Text>
      </View>
    </Dialog>
  );
}
