import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { setSignedInPerson } from "../src/api";
import { withSecurityFloor } from "../src/floor-gate";
import { notificationDestination } from "../src/links";
import { onSessionRefused } from "../src/session-refused";
import { useSignedIn } from "../src/signed-in";
import { useTheme } from "../src/theme";
import { useVersionVerdict, VersionGate } from "../src/version-gate";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
function Layout() {
  const theme = useTheme();
  const { data: session, isPending, refetch } = useSignedIn();
  // Who is signed in, said before anything below asks for their organization: each person's pick is their own.
  setSignedInPerson(session?.user.id);
  // A signed-in request refused as signed out: the session is read again, and one that is gone shows the sign-in.
  useEffect(() => onSessionRefused(() => void refetch()), [refetch]);
  // Asked before sign-in: whether this app and its OpenBot can work together. When they can't, one sentence covers
  // the app, so no screen behind it is seen failing.
  const { verdict, check } = useVersionVerdict(Boolean(session), isPending);
  const pending = useRef<unknown>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      pending.current = response.notification.request.content.data;
      if (session) {
        const destination = notificationDestination(pending.current);
        if (destination) router.push(destination);
        handled.current = id;
        pending.current = null;
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [session]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          // Every screen paints its own background: on Android XR a window without one is drawn see-through.
          contentStyle: { backgroundColor: theme.background },
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.foreground,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: "OpenBot" }} />
        <Stack.Screen name="conversation" options={{ title: "Conversation" }} />
        <Stack.Screen
          name="new-conversation"
          options={{ title: "New conversation" }}
        />
        <Stack.Screen name="bots" options={{ title: "Bots" }} />
        <Stack.Screen name="bot" options={{ title: "Bot" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="connect" options={{ title: "Add connection" }} />
        {/* Only the way back to Home after linking the company account: never seen, so no header flashes. */}
        <Stack.Screen
          name="company-sign-in/linked"
          options={{ headerShown: false, animation: "none" }}
        />
      </Stack>
      <VersionGate verdict={verdict} onRetry={() => void check()} />
    </View>
  );
}
export default withSecurityFloor(Layout);
