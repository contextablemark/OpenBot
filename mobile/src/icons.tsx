/**
 * Google's Material Symbols (rounded, filled), drawn natively by Jetpack Compose through @expo/ui. The vectors are in
 * assets/icons, downloaded with `npx add-material-symbols -o ./assets/icons --style rounded --fill <name>`. On other
 * platforms a plain glyph stands in.
 */
import { Icon as ComposeIcon, Host } from "@expo/ui/jetpack-compose";
import { type ColorValue, Platform, Text, View } from "react-native";

export const icons = {
  add: require("../assets/icons/add_rounded_fill.xml"),
  arrowUpward: require("../assets/icons/arrow_upward_rounded_fill.xml"),
  bolt: require("../assets/icons/bolt_rounded_fill.xml"),
  close: require("../assets/icons/close_rounded_fill.xml"),
  mic: require("../assets/icons/mic_rounded_fill.xml"),
  search: require("../assets/icons/search_rounded_fill.xml"),
  stop: require("../assets/icons/stop_rounded_fill.xml"),
} as const;

export type IconName = keyof typeof icons;

const GLYPHS: Record<IconName, string> = {
  add: "+",
  arrowUpward: "↑",
  bolt: "⚡",
  close: "✕",
  mic: "🎙",
  search: "⌕",
  stop: "■",
};

/** A Material Symbol inside a Compose control (a button's content): no host of its own. */
export function ComposeSymbol({
  name,
  size,
  color,
}: {
  name: IconName;
  size: number;
  color: ColorValue;
}) {
  return <ComposeIcon source={icons[name]} size={size} tint={color} />;
}

/** A Material Symbol anywhere in the React Native layout. Decorative: the control around it carries the label. */
export function MaterialIcon({
  name,
  size,
  color,
}: {
  name: IconName;
  size: number;
  color: string;
}) {
  if (Platform.OS === "android")
    return (
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{ width: size, height: size }}
      >
        <Host matchContents>
          <ComposeIcon source={icons[name]} size={size} tint={color} />
        </Host>
      </View>
    );
  return (
    <Text
      importantForAccessibility="no"
      style={{ fontSize: size * 0.85, color, textAlign: "center", width: size }}
    >
      {GLYPHS[name]}
    </Text>
  );
}
