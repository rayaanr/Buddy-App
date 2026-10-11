import { EARLIEST_BIRTH_YEAR, latestBirthYear, MIN_AGE } from '@buddy/shared';
import { Text, View } from 'react-native';

import { TextField } from '@/components/ui';

/** What's wrong with a typed birth year, or null when it's fine (or not finished). */
export function birthYearProblem(text: string) {
  if (text.length < 4) return null;
  const year = Number(text);
  if (year > latestBirthYear()) return `You need to be ${MIN_AGE} or over to use Buddy.`;
  if (year < EARLIEST_BIRTH_YEAR) return 'Check the year.';
  return null;
}

/** A four-digit year that's allowed (18 or over), or null. */
export function validBirthYear(text: string) {
  return text.length === 4 && !birthYearProblem(text) ? Number(text) : null;
}

/** "Birth year" as a plain four-digit field, with what's wrong said underneath. */
export function BirthYearField({
  value,
  onChange,
  tone,
}: {
  value: string;
  onChange: (text: string) => void;
  tone?: 'sunken' | 'inset';
}) {
  const problem = birthYearProblem(value);
  return (
    <View>
      <TextField
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholder="e.g. 1996"
        keyboardType="number-pad"
        maxLength={4}
        size="md"
        tone={tone}
        accessibilityLabel="Birth year"
      />
      {problem ? <Text className="mt-2 font-sans text-label text-danger">{problem}</Text> : null}
    </View>
  );
}
