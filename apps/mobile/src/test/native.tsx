/**
 * Renders components with NativeWind's native runtime, so tests see the
 * styles a phone gets. The web build hands classes straight to the browser,
 * which can hide classes that never reach native (that's how Reanimated
 * components once shipped unstyled).
 */
import path from 'node:path';

import type { ReactElement } from 'react';
// Importing nativewind/test registers its per-test setup (core components, reset).
import { act, fireEvent, screen } from 'nativewind/test';
import { cssToReactNativeRuntimeOptions } from 'nativewind/dist/metro/common';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { render as interopRender } from 'react-native-css-interop/test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../tailwind.config.js');

let css: Promise<string> | undefined;

/** The app's real stylesheet: same config and content as the Metro build. */
function stylesheet() {
  css ??= postcss([tailwind({ ...config, content: [path.join(__dirname, '../**/*.{ts,tsx}')] })])
    .process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })
    .then((r) => r.css);
  return css;
}

export async function render(ui: ReactElement) {
  return interopRender(ui, { css: await stylesheet(), cssOptions: cssToReactNativeRuntimeOptions });
}

export { act, fireEvent, screen };

/** The flattened style a host element ends up with. */
export function styleOf(testID: string): Record<string, unknown> {
  const node = screen.getByTestId(testID, { hidden: true });
  const style = node.props.style;
  const list = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...list.filter(Boolean));
}
