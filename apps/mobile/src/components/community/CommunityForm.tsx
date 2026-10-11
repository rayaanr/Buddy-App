import { LIMITS, type Place } from '@buddy/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CoverField } from '@/components/create/CoverField';
import { PhotoButton } from '@/components/create/PhotoButton';
import { TownField } from '@/components/places/TownField';
import {
  BackButton,
  Button,
  CloseIcon,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { usePickedImage } from '@/hooks/usePickedImage';
import { useScreenInsets } from '@/hooks/useScreenInsets';

interface CommunityValues {
  name: string;
  about: string;
  rules: string[];
  /** undefined: unchanged; null: removed; string: a new upload. */
  coverKey?: string | null;
  logoKey?: string | null;
  /** Unset: the server uses the creator's home town. */
  placeId?: number;
}

interface CommunityFormProps {
  heading: string;
  initial?: {
    name: string;
    about: string;
    rules: string[];
    coverUrl: string | null;
    logoUrl: string | null;
    place: Place | null;
  };
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (values: CommunityValues) => void;
}

/** Start a community, or (its creator) edit one. */
export function CommunityForm({
  heading,
  initial = { name: '', about: '', rules: [], coverUrl: null, logoUrl: null, place: null },
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
}: CommunityFormProps) {
  const { top } = useScreenInsets();
  const [name, setName] = useState(initial.name);
  const [about, setAbout] = useState(initial.about);
  const [rules, setRules] = useState(initial.rules);
  const [town, setTown] = useState(initial.place);
  const cover = usePickedImage('cover', initial.coverUrl);
  const logo = usePickedImage('logo', initial.logoUrl);

  const trimmed = name.trim();
  const ready =
    trimmed.length >= LIMITS.communityNameMin && !pending && !cover.uploading && !logo.uploading;
  // Always one empty line to type the next rule into, up to the limit.
  const editable = rules.length < LIMITS.communityRulesMax ? [...rules, ''] : rules;
  const setRule = (i: number, text: string) => {
    const next = editable.map((r, k) => (k === i ? text : r));
    // Trailing blanks aren't rules; the empty line below stays as row i, so typing keeps focus.
    while (next.length && !next[next.length - 1]) next.pop();
    setRules(next);
  };
  const removeRule = (i: number) => setRules(rules.filter((_, k) => k !== i));

  const submit = () => {
    if (!ready) return;
    onSubmit({
      name: trimmed,
      about: about.trim(),
      rules: rules.map((r) => r.trim()).filter(Boolean),
      coverKey: cover.key,
      logoKey: logo.key,
      placeId: town?.id,
    });
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View className="px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
      </View>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Heading size="page">{heading}</Heading>

        {/* Square, like an app icon; the name's initials stand in until there's one. */}
        <PhotoButton
          image={logo}
          name={trimmed || 'New community'}
          shape="rounded"
          size={84}
          noun="logo"
          emptyHint="Add a logo (optional)"
        />

        <SectionLabel className="mb-2 mt-6">Name</SectionLabel>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="e.g. Galle Fort Sketchers"
          maxLength={LIMITS.communityNameMax}
          autoCapitalize="words"
          tone="inset"
          size="md"
        />

        <SectionLabel className="mb-2 mt-6">Where it meets</SectionLabel>
        <TownField value={town} onChange={setTown} tone="inset" />
        <Text className="mt-2 font-sans text-[13px] leading-[18px] text-muted">
          People nearby see it first.
        </Text>

        <View className="mb-2 mt-6 flex-row items-baseline justify-between">
          <SectionLabel>About</SectionLabel>
          <Text className="font-mono text-[12px] text-subtle">
            {about.length}/{LIMITS.communityAboutMax}
          </Text>
        </View>
        <TextField
          value={about}
          onChangeText={setAbout}
          maxLength={LIMITS.communityAboutMax}
          placeholder="What you do, where and how often. Who it’s for."
          multiline
          textAlignVertical="top"
          tone="inset"
          size="md"
          className="h-28 py-3.5 leading-[22px]"
        />

        <SectionLabel className="mb-1 mt-6">Group rules</SectionLabel>
        <Text className="mb-2 font-sans text-[13px] leading-[18px] text-muted">
          Optional, up to {LIMITS.communityRulesMax}. Keep them short.
        </Text>
        <View className="gap-2">
          {editable.map((rule, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <Text className="w-6 font-mono-medium text-[13px] text-muted">
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View className="flex-1">
                <TextField
                  value={rule}
                  onChangeText={(text) => setRule(i, text)}
                  placeholder={i === 0 ? 'e.g. Be on time, we leave together' : 'Another rule'}
                  maxLength={LIMITS.communityRuleMax}
                  tone="inset"
                  size="md"
                />
              </View>
              {i < rules.length ? (
                <Pressable
                  onPress={() => removeRule(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove rule ${i + 1}`}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface active:opacity-80"
                >
                  <CloseIcon size={15} />
                </Pressable>
              ) : (
                <View className="w-9" />
              )}
            </View>
          ))}
        </View>

        <SectionLabel className="mb-2.5 mt-6">Cover photo</SectionLabel>
        <CoverField
          cover={cover}
          hue={COMMUNITY_HUE}
          removeLabel="Remove"
          hint="Optional, but it helps people find you."
        />
      </KeyboardAwareScrollView>

      <Footer>
        <Button label={pending ? pendingLabel : submitLabel} inactive={!ready} onPress={submit} />
      </Footer>
    </KeyboardScreen>
  );
}
