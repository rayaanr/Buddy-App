import type { UploadKind } from '@buddy/shared';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { uploadImage } from '@/api/upload';
import { toast } from '@/store/ui';

const CROP = {
  avatar: { aspect: [1, 1] as [number, number], shape: 'oval' as const },
  cover: { aspect: [16, 10] as [number, number], shape: 'rectangle' as const },
  logo: { aspect: [1, 1] as [number, number], shape: 'rectangle' as const },
  chat: { aspect: [4, 3] as [number, number], shape: 'rectangle' as const },
};

/**
 * A photo picked from the library and uploaded straight away, so saving the
 * form is quick. `key` is what to save: undefined leaves the photo as it was,
 * null removes it, a string is the new upload.
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
    remove: () => setPhoto({ uri: null, key: null }),
  };
}
