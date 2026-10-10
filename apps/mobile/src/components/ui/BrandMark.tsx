import { logoBox, logoSvg, type LogoTone } from '@buddy/shared';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

interface LogoProps {
  /** Height in points; the width follows the logo's shape. */
  height?: number;
  /** "mark" is the symbol alone; "full" adds the wordmark. */
  variant?: 'mark' | 'full';
  tone?: LogoTone;
  /** Announced as an image unless it's the screen's heading. */
  role?: 'image' | 'header';
}

/** The Buddy logo, drawn from the shared source in packages/shared/src/brand.ts. */
function Logo({ height = 24, variant = 'full', tone = 'dark', role = 'image' }: LogoProps) {
  const xml = useMemo(() => logoSvg({ tone, variant, title: null }), [tone, variant]);
  const box = logoBox(variant);
  return (
    <View accessible accessibilityRole={role} accessibilityLabel="Buddy" className="self-start">
      <SvgXml xml={xml} width={(height * box.width) / box.height} height={height} />
    </View>
  );
}

/** The logo at the top of the auth screens. */
export function BrandMark() {
  return <Logo height={26} role="header" />;
}
