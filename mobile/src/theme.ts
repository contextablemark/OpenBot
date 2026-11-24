/**
 * The colours and sizes of OpenBot's default look (app/src/theme.css), so the phone reads like OpenBot on the
 * computer. Light and dark follow the device. Hex values are the sRGB of the front end's oklch tokens.
 */
import * as Device from "expo-device";
import { useEffect, useState } from "react";
import { Platform, useColorScheme } from "react-native";

export type Theme = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  /** The primary colour at half strength: a primary button that can't be pressed yet, as on the computer. */
  primaryDisabled: string;
  muted: string;
  mutedForeground: string;
  border: string;
  sidebar: string;
  /** A row under the pointer or open: foreground at 5%. */
  rowActive: string;
  destructive: string;
  /** "Working" in a conversation row. */
  working: string;
  ring: string;
};

const light: Theme = {
  background: "#f9f9fb",
  foreground: "#010507",
  card: "#ffffff",
  primary: "#010507",
  primaryForeground: "#ffffff",
  primaryDisabled: "rgba(1,5,7,0.35)",
  muted: "#f0f0f4",
  mutedForeground: "#64646c",
  border: "#dbdbe5",
  sidebar: "#ededf5",
  rowActive: "rgba(1,5,7,0.05)",
  destructive: "#b42530",
  working: "#4f46e5",
  // Darker than the front end's #7480f1: the keyboard's focus ring needs 3:1 against the sidebar, and that is 3.0.
  ring: "#4f46e5",
};

const dark: Theme = {
  background: "#13101b",
  foreground: "#f0f0f4",
  card: "#1a1624",
  primary: "#f0f0f4",
  primaryForeground: "#010507",
  primaryDisabled: "rgba(240,240,244,0.35)",
  muted: "#241f30",
  mutedForeground: "#9a9aa6",
  border: "#2b2538",
  sidebar: "#0d0b13",
  rowActive: "rgba(240,240,244,0.05)",
  destructive: "#ff9aa0",
  working: "#a5b4fc",
  ring: "#8d97ff",
};

/*
 * Android XR (a headset, or glasses driven by a puck): OpenBot is drawn on black. Optical see-through glasses can only
 * add light, so black is see-through and anything light glows over the room: the light theme can't look solid there.
 * The dark theme with its surfaces at true black leaves the words, the bubbles and the borders floating in view.
 */
const glasses: Theme = {
  ...dark,
  background: "#000000",
  card: "#000000",
  sidebar: "#000000",
  // A pointer's hover and the open row have to show on a see-through display: 5% of white doesn't.
  rowActive: "rgba(240,240,244,0.16)",
  border: "#4a4560",
};

let onXr = false;
const listeners = new Set<() => void>();
if (Platform.OS === "android")
  void Device.hasPlatformFeatureAsync("android.software.xr.api.spatial")
    .then((xr) => {
      onXr = xr;
      if (xr) for (const listener of [...listeners]) listener();
    })
    .catch(() => undefined);

/** Whether this is Android XR, read again once the device has answered. */
export function useXr(): boolean {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return onXr;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  if (useXr()) return glasses;
  return scheme === "dark" ? dark : light;
}

/**
 * How big things are to touch and to read. A phone, folded or open, follows Material: every target at least 48dp.
 * Android XR follows its own guidance (developer.android.com/design/ui/xr/guides/visual-design): targets of 56dp, with
 * text a step larger, since the panel floats well away from the eyes and a pointer or a hand is less exact than a
 * finger.
 */
export type Sizes = {
  /** The least height (and width) of anything that can be pressed. */
  target: number;
  /** The space between two targets in a list. */
  rowGap: number;
  /** A conversation's or a Bot's name in a list. */
  row: number;
  /** A time, a description, a note. */
  small: number;
  /** A message. */
  message: number;
  messageLine: number;
  /** A round icon button: the send button, the new-conversation button. */
  iconButton: number;
};
const phoneSizes: Sizes = {
  target: 48,
  rowGap: 2,
  row: 15,
  small: 13,
  message: 16,
  messageLine: 24,
  iconButton: 40,
};
const xrSizes: Sizes = {
  target: 56,
  rowGap: 4,
  row: 17,
  small: 15,
  message: 18,
  messageLine: 27,
  iconButton: 48,
};
export function useSizes(): Sizes {
  return useXr() ? xrSizes : phoneSizes;
}

/** The type scale (15px base) and radii the front end uses. */
export const type = { xs: 11.25, sm: 13.125, base: 15, message: 16 } as const;
export const radius = { sm: 6, md: 8, lg: 10, xl: 14, composer: 16 } as const;

/**
 * From this width (Material's "medium" window: an open foldable, a tablet, a headset's panel) Home shows the
 * conversations beside the open one, as OpenBot on the computer does. A folded phone shows one at a time.
 */
export const SPLIT_MIN_WIDTH = 600;
/** The conversations panel's width beside an open conversation: 40% of the window, within these bounds. */
export const SIDEBAR_WIDTH = 340;
export const SIDEBAR_MIN_WIDTH = 260;
/** How wide a conversation's column grows. */
export const TRANSCRIPT_MAX_WIDTH = 768;
