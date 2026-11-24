import { Redirect, router } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { everyBot } from "../src/api";
import { Orb } from "../src/conversation-list";
import { useSignedIn } from "../src/signed-in";
import { Target } from "../src/target";
import { radius, TRANSCRIPT_MAX_WIDTH, useSizes, useTheme } from "../src/theme";
import { useLoad } from "../src/use-load";

/** Every Bot this person can talk to, each opening its page. */
export default function BotsScreen() {
  const theme = useTheme();
  const sizes = useSizes();
  const { data: session, isPending } = useSignedIn();
  const load = useCallback(() => everyBot(), []);
  const bots = useLoad(load, Boolean(session));
  if (!session && !isPending) return <Redirect href="/" />;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        width: "100%",
        maxWidth: TRANSCRIPT_MAX_WIDTH,
        alignSelf: "center",
        padding: 16,
        gap: 8,
      }}
    >
      {bots.error ? (
        <Text style={{ fontSize: sizes.small, color: theme.destructive }}>
          {bots.error}
        </Text>
      ) : null}
      {bots.data?.map((bot) => (
        <Target
          key={bot.id}
          accessibilityRole="link"
          accessibilityLabel={
            bot.title ? `${bot.name}, ${bot.title}` : bot.name
          }
          restingBackground={theme.card}
          onPress={() =>
            router.push({ pathname: "/bot", params: { botId: bot.id } })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Orb botId={bot.id} size={sizes.target - 12} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontSize: sizes.row,
                fontWeight: "600",
                color: theme.foreground,
              }}
            >
              {bot.name}
            </Text>
            {bot.title ? (
              <Text
                style={{ fontSize: sizes.small, color: theme.mutedForeground }}
              >
                {bot.title}
              </Text>
            ) : null}
          </View>
        </Target>
      ))}
      {bots.data?.length === 0 && (
        <Text style={{ fontSize: sizes.row, color: theme.mutedForeground }}>
          No Bots yet. Create one in OpenBot on your computer.
        </Text>
      )}
    </ScrollView>
  );
}
