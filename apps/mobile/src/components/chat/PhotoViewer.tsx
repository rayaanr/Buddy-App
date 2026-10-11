import { Image } from 'expo-image';
import { Modal, StyleSheet, View } from 'react-native';

import { CloseIcon, IconButton } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

/** A chat photo full screen, on black. */
export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { top } = useScreenInsets();
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {url ? (
          <Image source={{ uri: url }} style={styles.photo} contentFit="contain" transition={150} />
        ) : null}
        <View style={[styles.close, { top: top(56) }]}>
          <IconButton tone="glass" icon={<CloseIcon />} label="Close photo" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  photo: { flex: 1 },
  close: { position: 'absolute', right: 18 },
});
