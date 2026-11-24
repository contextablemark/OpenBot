import { router } from "expo-router";
import { ScrollView } from "react-native";
import { ConnectForm } from "../src/connect-form";
import { TRANSCRIPT_MAX_WIDTH, useTheme } from "../src/theme";

/** Settings' "Add connection": another OpenBot to switch to, kept beside the others. Connecting opens it. */
export default function ConnectScreen() {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        width: "100%",
        maxWidth: TRANSCRIPT_MAX_WIDTH,
        alignSelf: "center",
        padding: 16,
      }}
    >
      <ConnectForm onConnected={() => router.dismissTo("/")} />
    </ScrollView>
  );
}
