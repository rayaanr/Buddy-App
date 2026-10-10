import { LIMITS } from '@buddy/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { CoverField } from '@/components/create/CoverField';
import {
  ActionSheet,
  Avatar,
  BackButton,
  Button,
  CameraIcon,
  CloseIcon,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  PressableScale,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { usePickedImage } from '@/hooks/usePickedImage';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors } from '@/theme';

interface CommunityValues {
  name: string;
  about: string;
  rules: string[];
  /** undefined: unchanged; null: removed; string: a new upload. */
  coverKey?: string | null;
  logoKey?: string | null;
}

interface CommunityFormProps {
  heading: string;
  initial?: {
    name: string;
    about: string;
    rules: string[];
    coverUrl: string | null;
    logoUrl: string | null;
  };
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (values: CommunityValues) => void;
}

/** Start a community, or (its creator) edit one. */
export function CommunityForm({
  heading,
  initial = { name: '', about: '', rules: [], coverUrl: null, logoUrl: null },
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
}: CommunityFormProps) {
  const { top } = useScreenInsets();
  const [name, setName] = useState(initial.name);
  const [about, setAbout] = useState(initial.about);
  const [rules, setRules] = useState(initial.rules);
  const cover = usePickedImage('cover', initial.coverUrl);
  const logo = usePickedImage('logo', initial.logoUrl);
  const [logoMenu, setLogoMenu] = useState(false);

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
        <PressableScale
          onPress={() => (logo.uri ? setLogoMenu(true) : void logo.pick())}
          disabled={logo.uploading}
          accessibilityRole="button"
          accessibilityLabel={logo.uri ? 'Change logo' : 'Add a logo'}
          className="mt-6 self-center"
        >
          <Avatar
            uri={logo.uri ?? undefined}
            name={trimmed || 'New community'}
            shape="rounded"
            size={84}
          />
          {logo.uploading ? (
            <View className="absolute inset-0 items-center justify-center rounded-[24px] bg-black/50">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : null}
          <View className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-lime">
            <CameraIcon />
          </View>
        </PressableScale>
        <Text className="mt-2.5 text-center font-sans text-[13.5px] text-muted">
          {logo.uploading ? 'Uploading…' : logo.uri ? 'Change logo' : 'Add a logo (optional)'}
        </Text>

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

      <ActionSheet
        visible={logoMenu}
        onClose={() => setLogoMenu(false)}
        actions={[
          { label: 'Choose a new logo', onPress: () => void logo.pick() },
          { label: 'Remove logo', destructive: true, onPress: logo.remove },
        ]}
      />

      <Footer>
        <Button label={pending ? pendingLabel : submitLabel} inactive={!ready} onPress={submit} />
      </Footer>
    </KeyboardScreen>
  );
}
