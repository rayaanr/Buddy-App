import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { Photo, Scrim } from '@/components/ui';
import { shadows } from '@/theme';

const SHADOW = {
  boxShadow: shadows.overlay,
};

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=70&auto=format&fit=crop`;

/** Made-up activities for the signed-out screens: the same examples as the landing page. */
export const EXAMPLE_CARDS: FanCardData[] = [
  {
    eyebrow: 'TONIGHT · 18:00',
    title: 'Sunset 5K at Galle Face',
    coverUrl: photo('1552674605-db6ffd4facb5'),
    hue: '#5a3420',
  },
  {
    eyebrow: 'SUN · 16:30',
    title: 'Beach cricket, Mount Lavinia',
    coverUrl: photo('1523275147196-8c1f5e82a3a3'),
    hue: '#6b5b44',
  },
  {
    eyebrow: 'TONIGHT · 19:30',
    title: 'Board games night',
    coverUrl: photo('1676562330790-f0875c4f7fa8'),
    hue: '#3b2a20',
  },
];

export interface FanCardData {
  coverUrl: string | null;
  /** Shown while the photo loads, or instead of a missing one. */
  hue: string;
  /** Small lime line above the title, e.g. "TONIGHT · 18:00". */
  eyebrow: string;
  title: string;
}

/** Three activity cards fanned out, front one labelled; a lime pill underneath. */
export function CardFan({ cards, badge }: { cards: FanCardData[]; badge?: string }) {
  const [front, right, left] = cards;
  if (!front) return null;
  return (
    <View style={{ width: 300, height: 250 }}>
      {left ? (
        <FanCard
          card={left}
          style={{ left: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '-11deg' }] }}
        />
      ) : null}
      {right ? (
        <FanCard
          card={right}
          style={{ right: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '11deg' }] }}
        />
      ) : null}
      <FanCard card={front} radius={24} style={{ left: 65, top: 0, width: 170, height: 226 }}>
        <Scrim from={0.4} opacity={0.9} />
        <View className="absolute inset-x-3 bottom-3">
          <Text className="font-mono-medium text-micro tracking-[1.05px] text-lime">
            {front.eyebrow}
          </Text>
          <Text className="mt-[5px] font-sans-semibold text-label leading-footnote text-ink">
            {front.title}
          </Text>
        </View>
      </FanCard>
      {badge ? (
        <View className="absolute -bottom-1.5 h-8 justify-center self-center rounded-2xl bg-lime px-3.5">
          <Text className="font-sans-semibold text-label text-bg" numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FanCardProps {
  card: FanCardData;
  style: ViewStyle;
  radius?: number;
  children?: ReactNode;
}

/** Shadow lives on the wrapper because iOS clips shadows on overflow-hidden views. */
function FanCard({ card, style, radius = 22, children }: FanCardProps) {
  return (
    // Android elevation needs a background to cast a shadow.
    <View
      style={[
        { position: 'absolute', borderRadius: radius, backgroundColor: card.hue },
        SHADOW,
        style,
      ]}
    >
      <Photo
        uri={card.coverUrl ?? undefined}
        hue={card.hue}
        className="flex-1 border border-card-edge"
        style={{ borderRadius: radius }}
      >
        {children}
      </Photo>
    </View>
  );
}
