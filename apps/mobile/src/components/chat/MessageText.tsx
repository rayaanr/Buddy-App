import { type ChatMessage, firstName } from '@buddy/shared';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { cn } from '@/lib/cn';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A message's text with @mentions in bold (tapping one opens their profile).
 * Mentions are written as "@FirstName"; only people the server confirmed as
 * tagged are highlighted.
 */
export function MessageText({
  body,
  mentions,
  mine,
}: {
  body: string;
  mentions: ChatMessage['mentions'];
  mine: boolean;
}) {
  const base = cn('font-sans text-body leading-subhead', mine ? 'text-bg' : 'text-ink');
  const byName = new Map(mentions.map((m) => [firstName(m.name).toLowerCase(), m]));
  if (!byName.size) return <Text className={base}>{body}</Text>;

  const names = [...byName.keys()].map(escape).join('|');
  // Capturing group: the split keeps the "@Name" parts, at odd positions.
  const parts = body.split(new RegExp(`(@(?:${names}))(?![\\p{L}\\p{N}])`, 'giu'));
  return (
    <Text className={base}>
      {parts.map((part, k) => {
        const person = k % 2 ? byName.get(part.slice(1).toLowerCase()) : undefined;
        if (!person) return part;
        return (
          <Text
            key={k}
            onPress={() => router.push(`/user/${person.id}`)}
            accessibilityRole="link"
            className={cn('font-sans-semibold', mine ? 'text-bg underline' : 'text-lime')}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
