import { useMutation } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { deleteAccount, useMe } from '@/api/queries';
import { BackButton, Button, Footer, Heading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

const WHAT_GOES = [
  'Your profile, photos, interests and email address',
  'Your place in activities and communities you joined',
  'Upcoming activities you host are cancelled, and everyone going is told',
  'Messages you sent stay in their chats, shown as from “Deleted account”',
];

/**
 * Profile → Delete account. This screen is the confirmation step: deletion is
 * immediate and permanent (required by both app stores).
 */
export default function DeleteAccountScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  // Push tokens are deleted with the account. The root navigator returns to
  // sign-up once the session is gone.
  const remove = useMutation({ mutationFn: deleteAccount });
  const deleting = remove.isPending || remove.isSuccess;
  const error = remove.error ? errorMessage(remove.error) : null;

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
          onPress={() => remove.mutate()}
        />
      </Footer>
    </View>
  );
}
