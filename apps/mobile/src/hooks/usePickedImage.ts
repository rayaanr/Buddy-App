import { artKey, isFallbackUrl, type UploadKind } from '@buddy/shared';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { uploadImage } from '@/api/upload';
import { artUri } from '@/lib/art';
import { toast } from '@/store/ui';

const CROP = {
  avatar: { aspect: [1, 1] as [number, number], shape: 'oval' as const },
  cover: { aspect: [16, 10] as [number, number], shape: 'rectangle' as const },
  logo: { aspect: [1, 1] as [number, number], shape: 'rectangle' as const },
  chat: { aspect: [4, 3] as [number, number], shape: 'rectangle' as const },
};

/**
 * A photo picked from the library and uploaded straight away, so saving the
 * form is quick, or one of Buddy's own pictures. `key` is what to save:
 * undefined leaves it as it was, null removes it (the server then gives it
 * one of ours), a string is the new upload or `art:<id>`.
 */
export function usePickedImage(kind: UploadKind, initialUri: string | null) {
  const [photo, setPhoto] = useState<{ uri: string | null; key?: string | null }>({
    uri: initialUri,
  });
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      ...CROP[kind],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const before = photo;
    setPhoto({ uri: asset.uri });
    setUploading(true);
    try {
      setPhoto({ uri: asset.uri, key: await uploadImage(kind, asset) });
    } catch (err) {
      setPhoto(before);
      toast(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return {
    uri: photo.uri,
    key: photo.key,
    uploading,
    pick,
    /** One of Buddy's own pictures instead of a photo. */
    choose: (id: string) => setPhoto({ uri: artUri(id), key: artKey(id) }),
    /** It's one of ours, not a photo someone uploaded (so there's nothing to remove). */
    isArt: isFallbackUrl(photo.uri),
    remove: () => setPhoto({ uri: null, key: null }),
  };
}
