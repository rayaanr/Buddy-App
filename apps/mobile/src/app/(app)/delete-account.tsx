import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { deleteAccount, useMe } from '@/api/queries';
import { BackButton, Button, Footer, Heading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

const WHAT_GOES = [
  'Your profile, photo and interests',
  'Your messages in every group chat',
  'Activities you host, for everyone going',
  'Your place in activities and communities you joined',
];

/**
 * Profile → Delete account. This screen is the confirmation step: deletion is
 * immediate and permanent (required by both app stores).
 */
export default function DeleteAccountScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      // Push tokens are deleted with the account. The root navigator returns to
      // sign-up once the session is gone.
      await deleteAccount();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-1 px-[22px]" style={{ paddingTop: top(56) }}>
        <BackButton />
        <Heading size="page" className="mt-6">
          Delete your account?
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          This permanently deletes{' '}
          <Text className="text-ink">{me.data?.email ?? 'your account'}</Text> and can’t be undone.
          It removes:
        </Text>
        <View className="mt-4 gap-2.5">
          {WHAT_GOES.map((line) => (
            <View key={line} className="flex-row gap-3">
              <Text className="font-sans text-[15.5px] text-danger">•</Text>
              <Text className="flex-1 font-sans text-[15.5px] leading-[22px] text-ink-dim">
                {line}
              </Text>
            </View>
          ))}
        </View>
        <Text className="mt-5 font-sans text-[14.5px] leading-[21px] text-muted">
          Signing up again later with the same email starts a new, empty account.
        </Text>
        {error ? <Text className="mt-4 font-sans text-[14px] text-danger">{error}</Text> : null}
      </View>

      <Footer>
        <Button
          label={deleting ? 'Deleting…' : 'Delete my account'}
          variant="danger-outline"
          disabled={deleting}
          onPress={confirm}
        />
      </Footer>
    </View>
  );
}
