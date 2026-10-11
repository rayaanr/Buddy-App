import { focusManager, onlineManager } from '@tanstack/react-query';
import { addNetworkStateListener } from 'expo-network';
import { AppState, Platform } from 'react-native';

/**
 * Tells React Query what a browser would: whether the app is in front, and
 * whether there's a connection. In front again → stale screens refresh and
 * polls resume; in the background → polls pause; offline → requests wait
 * instead of failing, then run when the connection is back. (On web the
 * browser's own events already do this.)
 */
export function connectQueriesToApp() {
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    // Unknown (not yet checked) counts as online: only a definite "no" pauses requests.
    const sub = addNetworkStateListener((s) =>
      setOnline(s.isConnected !== false && s.isInternetReachable !== false),
    );
    return () => sub.remove();
  });
}
