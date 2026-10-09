import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Display headings use Schibsted Grotesk with tight tracking. Letter spacing is
 * expressed in px (RN has no em units): size × the prototype's em value.
 */
const HEADINGS = {
  /** 40px — auth & onboarding hero headings. */
  hero: 'font-display text-[40px] leading-[42px] tracking-[-1.4px]',
  /** 36px — tab screen titles. */
  screen: 'font-display text-[36px] leading-[40px] tracking-[-1.26px]',
  /** 32px — detail, community and profile names. */
  page: 'font-display text-[32px] leading-[35px] tracking-[-0.96px]',
  /** 30px — user profile, picks header. */
  section: 'font-display text-[30px] leading-[33px] tracking-[-0.9px]',
  /** 27px — photo card titles. */
  card: 'font-display text-[27px] leading-[30px] tracking-[-0.68px]',
  /** 24px — sheets. */
  sheet: 'font-display text-[24px] leading-[28px] tracking-[-0.48px]',
} as const;

interface HeadingProps extends TextProps {
  size?: keyof typeof HEADINGS;
  className?: string;
}

export function Heading({ size = 'screen', className, ...rest }: HeadingProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn('text-ink', HEADINGS[size], className)}
      {...rest}
    />
  );
}

/** Uppercase monospaced section label, e.g. "USUALLY FREE". */
export function SectionLabel({
  className,
  tone = 'muted',
  ...rest
}: TextProps & { className?: string; tone?: 'muted' | 'lime' }) {
  return (
    <Text
      className={cn(
        'font-mono-medium text-[12px] uppercase tracking-[1.44px]',
        tone === 'lime' ? 'text-lime' : 'text-muted',
        className,
      )}
      {...rest}
    />
  );
}

/** Lime monospaced tag above titles, e.g. "RUNNING". */
export function Eyebrow({ className, ...rest }: TextProps & { className?: string }) {
  return (
    <Text
      className={cn('font-mono-medium text-[12.5px] tracking-[1.25px] text-lime', className)}
      {...rest}
    />
  );
}
