import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The prototype is drawn on a 390×844 frame with a 52px status bar and a
 * 34px home indicator baked into its paddings. This converts those design
 * paddings into real safe-area-aware values.
 */
const DESIGN_STATUS_BAR = 52;
const DESIGN_HOME_INDICATOR = 22;

export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  return {
    insets,
    /** Top padding for a design value measured from the top of the phone frame. */
    top: (designTop: number) => insets.top + Math.max(0, designTop - DESIGN_STATUS_BAR),
    /** Bottom padding for a design value measured from the bottom of the phone frame. */
    bottom: (designBottom: number) =>
      Math.max(insets.bottom, 12) + Math.max(0, designBottom - DESIGN_HOME_INDICATOR),
  };
}
