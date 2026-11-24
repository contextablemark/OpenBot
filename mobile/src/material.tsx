/**
 * The controls drawn with Google's Material 3 (androidx.compose.material3, with its Expressive components) through
 * @expo/ui on Android: the new-conversation button, the send button and the "Thinking" indicator. The layout and the
 * conversation itself keep OpenBot's own look (./theme.ts); only these controls are Material. On other platforms each
 * falls back to a plain React Native control of the same size.
 */
import {
  CircularWavyProgressIndicator,
  Button as ComposeButton,
  Text as ComposeText,
  ExtendedFloatingActionButton,
  FilledIconButton,
  FilledTonalIconButton,
  Host,
} from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { ComposeSymbol, MaterialIcon } from "./icons";
import { type Theme, useSizes, useTheme } from "./theme";

const android = Platform.OS === "android";

/**
 * What a screen reader says and does for a Compose icon button, whose own content is only an icon: the
 * React Native wrapper carries the name and the role, and TalkBack's activate goes to the same press as a tap.
 */
function iconButtonAccessibility(
  label: string,
  onPress: () => void,
  enabled = true,
) {
  return {
    accessible: true,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: !enabled },
    accessibilityActions: [{ name: "activate" as const }],
    onAccessibilityAction: () => {
      if (enabled) onPress();
    },
  };
}

/** The send button: a filled round icon button in the primary colour. */
export function SendButton({
  enabled,
  onPress,
}: {
  enabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  if (android)
    return (
      <View
        {...iconButtonAccessibility("Send", onPress, enabled)}
        style={{
          minWidth: sizes.target,
          minHeight: sizes.target,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Host matchContents>
          <FilledIconButton
            enabled={enabled}
            onClick={onPress}
            colors={{
              containerColor: theme.primary,
              contentColor: theme.primaryForeground,
              disabledContainerColor: theme.primaryDisabled,
              disabledContentColor: theme.primaryForeground,
            }}
            modifiers={[size(sizes.iconButton, sizes.iconButton)]}
          >
            <ComposeSymbol
              name="arrowUpward"
              size={sizes.iconButton * 0.55}
              color={theme.primaryForeground}
            />
          </FilledIconButton>
        </Host>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.primary,
        opacity: enabled ? 1 : 0.5,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.primaryForeground, fontWeight: "700" }}>
        ↑
      </Text>
    </Pressable>
  );
}

/** "Thinking", with Material 3 Expressive's wavy indicator. */
export function Thinking() {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel="Thinking"
      style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
    >
      {android ? (
        <Host style={{ width: 24, height: 24 }}>
          <CircularWavyProgressIndicator
            color={theme.ring}
            trackColor={theme.muted}
            modifiers={[size(24, 24)]}
          />
        </Host>
      ) : (
        <ActivityIndicator size="small" color={theme.mutedForeground} />
      )}
      <Text style={{ fontSize: 13, color: theme.mutedForeground }}>
        Thinking
      </Text>
    </View>
  );
}

/** The phone list's floating "New conversation" button. */
export function NewConversationFab({
  onPress,
  bottom = 24,
}: {
  onPress: () => void;
  /** How far above the bottom of the screen: above whatever is pinned there. */
  bottom?: number;
}) {
  const theme = useTheme();
  if (android)
    return (
      <View style={{ position: "absolute", right: 16, bottom }}>
        <Host matchContents>
          <ExtendedFloatingActionButton
            containerColor={theme.primary}
            onClick={onPress}
          >
            <ExtendedFloatingActionButton.Icon>
              <ComposeSymbol
                name="add"
                size={24}
                color={theme.primaryForeground}
              />
            </ExtendedFloatingActionButton.Icon>
            <ExtendedFloatingActionButton.Text>
              <ComposeText color={theme.primaryForeground}>
                New conversation
              </ComposeText>
            </ExtendedFloatingActionButton.Text>
          </ExtendedFloatingActionButton>
        </Host>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New conversation"
      onPress={onPress}
      style={{
        position: "absolute",
        right: 16,
        bottom,
        paddingHorizontal: 18,
        height: 48,
        borderRadius: 16,
        backgroundColor: theme.primary,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.primaryForeground, fontWeight: "600" }}>
        ＋ New conversation
      </Text>
    </Pressable>
  );
}

/** The sidebar header's small "new conversation" button: a tonal icon button. */
export function NewConversationIconButton({
  onPress,
}: {
  onPress: () => void;
}) {
  const theme: Theme = useTheme();
  const sizes = useSizes();
  if (android)
    return (
      <View
        {...iconButtonAccessibility("New conversation", onPress)}
        style={{
          minWidth: sizes.target,
          minHeight: sizes.target,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Host matchContents>
          <FilledTonalIconButton
            onClick={onPress}
            colors={{
              containerColor: theme.muted,
              contentColor: theme.foreground,
            }}
            modifiers={[size(sizes.iconButton, sizes.iconButton)]}
          >
            <ComposeSymbol
              name="add"
              size={sizes.iconButton * 0.55}
              color={theme.foreground}
            />
          </FilledTonalIconButton>
        </Host>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New conversation"
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.muted,
      }}
    >
      <Text style={{ fontSize: 18, color: theme.foreground }}>＋</Text>
    </Pressable>
  );
}

/** A screen's main action: a filled Material button in the primary colour. */
export function PrimaryButton({
  label,
  onPress,
  enabled = true,
}: {
  label: string;
  onPress: () => void;
  enabled?: boolean;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  if (android)
    return (
      <View
        style={{
          alignSelf: "flex-start",
          minHeight: sizes.target,
          justifyContent: "center",
        }}
      >
        <Host matchContents>
          <ComposeButton
            enabled={enabled}
            onClick={onPress}
            colors={{
              containerColor: theme.primary,
              contentColor: theme.primaryForeground,
            }}
          >
            <ComposeText color={theme.primaryForeground}>{label}</ComposeText>
          </ComposeButton>
        </Host>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!enabled}
      onPress={onPress}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 20,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primary,
        opacity: enabled ? 1 : 0.5,
        justifyContent: "center",
      }}
    >
      <Text style={{ color: theme.primaryForeground, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Dictation's button: tonal while it waits; red while it records, with a ring that swells with the voice. */
export function MicButton({
  listening,
  level = 0,
  onPress,
  enabled = true,
}: {
  listening: boolean;
  /** How loud the voice is, 0 to 1. */
  level?: number;
  onPress: () => void;
  enabled?: boolean;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  const visible = sizes.iconButton;
  const recording = "#d93025";
  return (
    <View
      style={{
        // The same box as the send button beside it, so the two line up.
        minWidth: sizes.target,
        minHeight: sizes.target,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {listening ? (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            width: visible,
            height: visible,
            borderRadius: visible / 2,
            backgroundColor: recording,
            opacity: 0.25,
            transform: [{ scale: 1.15 + level * 0.45 }],
          }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop dictating" : "Dictate"}
        accessibilityHint={
          listening
            ? "Stops by itself after a few seconds of silence."
            : undefined
        }
        accessibilityState={{ selected: listening, disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        hitSlop={(sizes.target - visible) / 2}
        style={({ pressed }) => ({
          width: visible,
          height: visible,
          borderRadius: visible / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: listening ? recording : theme.muted,
          opacity: !enabled ? 0.5 : pressed ? 0.8 : 1,
        })}
      >
        <MaterialIcon
          name={listening ? "stop" : "mic"}
          size={visible * 0.55}
          color={listening ? "#ffffff" : theme.foreground}
        />
      </Pressable>
    </View>
  );
}
