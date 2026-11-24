/** A person's avatar, as OpenBot's sidebar draws it: their initial in a muted circle. */
import { Text, View } from "react-native";
import { initialOf } from "./account";
import { useTheme } from "./theme";

export function Avatar({
  name,
  email,
  size,
}: {
  name?: string | null;
  email?: string;
  size: number;
}) {
  const theme = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.muted,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.42, color: theme.mutedForeground }}>
        {initialOf(name, email)}
      </Text>
    </View>
  );
}
