import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { Photo, Scrim } from '@/components/ui';

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 16 },
  elevation: 12,
};

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
          <Text className="font-mono-medium text-[10.5px] tracking-[1.05px] text-lime">
            {front.eyebrow}
          </Text>
          <Text className="mt-[5px] font-sans-semibold text-[14px] leading-[17.5px] text-ink">
            {front.title}
          </Text>
        </View>
      </FanCard>
      {badge ? (
        <View className="absolute -bottom-1.5 h-8 justify-center self-center rounded-2xl bg-lime px-3.5">
          <Text className="font-sans-semibold text-[13.5px] text-bg" numberOfLines={1}>
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
        className="flex-1 border border-[#2a2c29]"
        style={{ borderRadius: radius }}
      >
        {children}
      </Photo>
    </View>
  );
}
