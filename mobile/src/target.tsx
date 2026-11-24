/**
 * Anything a person presses in a list: a conversation, a Bot, a link. At least the target size for the device
 * (./theme.ts `useSizes`), with three kinds of feedback, so the person knows what they are about to press:
 * - pressed: the row darkens,
 * - hovered by a pointer (a headset's hand ray or a mouse): it darkens too, before anything is pressed,
 * - focused from a keyboard (Tab): a ring in the focus colour.
 */
import { type ReactNode, useState } from "react";
import {
  type AccessibilityRole,
  type AccessibilityState,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { radius, useSizes, useTheme } from "./theme";

export function Target({
  onPress,
  children,
  selected = false,
  disabled = false,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityState,
  style,
  restingBackground = "transparent",
}: {
  onPress: () => void;
  children: ReactNode;
  /** Open or chosen: drawn as if pressed, and said so. */
  selected?: boolean;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
  /** The background when nothing is happening to it. */
  restingBackground?: string;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled, ...accessibilityState }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: sizes.target,
          justifyContent: "center",
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: "transparent",
          backgroundColor:
            pressed || hovered || selected
              ? theme.rowActive
              : restingBackground,
          opacity: disabled ? 0.5 : 1,
        },
        style,
        // Last, so a caller's own border never hides where the keyboard is.
        focused ? { borderWidth: 2, borderColor: theme.ring } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
