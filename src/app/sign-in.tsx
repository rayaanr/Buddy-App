import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { BrandMark, Button, Heading, Photo, Scrim } from '@/components/ui';
import { useDeckIds } from '@/hooks/useDeck';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { firstName, shortLocation, whenLabel } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useAccount, useSessionStore } from '@/store/session';
import type { Activity } from '@/types/models';

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 16 },
  elevation: 12,
};

export default function SignInScreen() {
  const { top, bottom } = useScreenInsets();
  const account = useAccount();
  const signIn = useSessionStore((s) => s.signIn);
  const startOver = useSessionStore((s) => s.startOver);
  const activities = useActivitiesStore((s) => s.activities);
  const ids = useDeckIds();

  const pick = (k: number) => activities.find((a) => a.id === (ids[k] ?? ids[0]));
  const name = firstName(account.name);

  return (
    <View
      className="flex-1 bg-bg px-[22px]"
      style={{ paddingTop: top(64), paddingBottom: bottom(34) }}
    >
      <BrandMark />
      <View className="flex-1 items-center justify-center pt-2.5">
        <PicksFan
          front={pick(0)}
          left={pick(2)}
          right={pick(1)}
          label={`${ids.length} new picks near ${shortLocation(account.location)}`}
        />
      </View>
      <Heading size="hero" className="text-center">
        Good to see you, {name}
      </Heading>
      <Text className="mt-3 text-center font-sans text-[16px] leading-[23px] text-muted">
        Signed out on this device.
      </Text>
      <Button label={`Continue as ${name}`} onPress={signIn} className="mt-7" />
      <Button
        label="Not you? Start over"
        variant="ghost"
        size="md"
        onPress={startOver}
        className="mt-2.5"
        weight="medium"
      />
    </View>
  );
}

function PicksFan({
  front,
  left,
  right,
  label,
}: {
  front?: Activity;
  left?: Activity;
  right?: Activity;
  label: string;
}) {
  if (!front) return null;
  return (
    <View style={{ width: 300, height: 250 }}>
      {left ? (
        <FanCard
          activity={left}
          style={{ left: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '-11deg' }] }}
        />
      ) : null}
      {right ? (
        <FanCard
          activity={right}
          style={{ right: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '11deg' }] }}
        />
      ) : null}
      <FanCard activity={front} radius={24} style={{ left: 65, top: 0, width: 170, height: 226 }}>
        <Scrim from={0.4} opacity={0.9} />
        <View className="absolute inset-x-3 bottom-3">
          <Text className="font-mono-medium text-[10.5px] tracking-[1.05px] text-lime">
            {whenLabel(front)}
          </Text>
          <Text className="mt-[5px] font-sans-semibold text-[14px] leading-[17.5px] text-ink">
            {front.title}
          </Text>
        </View>
      </FanCard>
      <View className="absolute -bottom-1.5 h-8 justify-center self-center rounded-2xl bg-lime px-3.5">
        <Text className="font-sans-semibold text-[13.5px] text-bg" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

interface FanCardProps {
  activity: Activity;
  style: ViewStyle;
  radius?: number;
  children?: ReactNode;
}

/** Shadow lives on the wrapper because iOS clips shadows on overflow-hidden views. */
function FanCard({ activity, style, radius = 22, children }: FanCardProps) {
  return (
    // Android elevation needs a background to cast a shadow.
    <View
      style={[
        { position: 'absolute', borderRadius: radius, backgroundColor: activity.hue },
        SHADOW,
        style,
      ]}
    >
      <Photo
        uri={activity.image}
        hue={activity.hue}
        className="flex-1 border border-[#2a2c29]"
        style={{ borderRadius: radius }}
      >
        {children}
      </Photo>
    </View>
  );
}
