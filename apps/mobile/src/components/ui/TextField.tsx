import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme';

interface TextFieldProps extends TextInputProps {
  className?: string;
  mono?: boolean;
  /** "sunken" sits on the page background, "inset" on a raised sheet. */
  tone?: 'sunken' | 'inset';
  /** lg: 54px / 16px text (auth forms). md: 52px / 15.5px text (create, edit). */
  size?: 'lg' | 'md';
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { className, mono, tone = 'sunken', size = 'lg', multiline, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.subtle}
      selectionColor={colors.lime}
      multiline={multiline}
      className={cn(
        'rounded-2xl border border-field px-4 text-ink',
        size === 'lg' ? 'text-[16px]' : 'text-[15.5px]',
        // Multiline fields set their own height.
        !multiline && (size === 'lg' ? 'h-[54px]' : 'h-[52px]'),
        tone === 'sunken' ? 'bg-surface-sunken' : 'bg-bg',
        mono ? 'font-mono' : 'font-sans',
        className,
      )}
      {...rest}
    />
  );
});
