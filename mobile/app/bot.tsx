import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { ORGANIZATION_ID } from "../src/api";
import { getBot } from "../src/api/generated/bots/bots";
import { listConversations } from "../src/api/generated/conversations/conversations";
import { Orb } from "../src/conversation-list";
import { rowTitle } from "../src/conversation-row";
import { PrimaryButton } from "../src/material";
import { relativeTimeShort } from "../src/relative-time";
import { useSignedIn } from "../src/signed-in";
import { Target } from "../src/target";
import { TRANSCRIPT_MAX_WIDTH, useSizes, useTheme } from "../src/theme";
import { useLoad } from "../src/use-load";

/** A Bot: who it is, a new conversation with it, and the conversations already had with it. */
export default function BotScreen() {
  const theme = useTheme();
  const sizes = useSizes();
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const { data: session, isPending } = useSignedIn();
  const loadBot = useCallback(
    () => getBot(ORGANIZATION_ID, botId ?? ""),
    [botId],
  );
  const bot = useLoad(loadBot, Boolean(session && botId));
  const loadConversations = useCallback(
    () => listConversations(ORGANIZATION_ID, { botId: botId ?? "", limit: 50 }),
    [botId],
  );
  const conversations = useLoad(loadConversations, Boolean(session && botId));
  if (!session && !isPending) return <Redirect href="/" />;
  const info = bot.data?.bot;
  const problem = bot.error || conversations.error;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        width: "100%",
        maxWidth: TRANSCRIPT_MAX_WIDTH,
        alignSelf: "center",
        padding: 16,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Orb botId={botId} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontSize: 22.5,
              fontWeight: "600",
              color: theme.foreground,
            }}
          >
            {info?.name ?? ""}
          </Text>
          {info?.title ? (
            <Text
              style={{
                fontSize: sizes.small + 1,
                color: theme.mutedForeground,
              }}
            >
              {info.title}
            </Text>
          ) : null}
        </View>
      </View>
      {info?.roleDescription ? (
        <Text
          style={{
            fontSize: sizes.row,
            lineHeight: sizes.row * 1.45,
            color: theme.foreground,
          }}
        >
          {info.roleDescription}
        </Text>
      ) : null}
      {problem ? (
        <Text style={{ fontSize: sizes.small, color: theme.destructive }}>
          {problem}
        </Text>
      ) : null}
      <PrimaryButton
        label="New conversation"
        enabled={Boolean(botId)}
        onPress={() =>
          router.push({ pathname: "/new-conversation", params: { botId } })
        }
      />
      <Text
        accessibilityRole="header"
        style={{
          fontSize: sizes.row,
          fontWeight: "600",
          color: theme.foreground,
        }}
      >
        Conversations
      </Text>
      <View style={{ gap: sizes.rowGap }}>
        {conversations.data?.conversations.map((conversation) => (
          <Target
            key={conversation.id}
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: "/conversation",
                params: {
                  channelId: conversation.id,
                  agentId: botId,
                  title: rowTitle(conversation),
                },
              })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: sizes.row, color: theme.foreground }}
            >
              {rowTitle(conversation)}
            </Text>
            {conversation.lastMessageAt ? (
              <Text
                style={{ fontSize: sizes.small, color: theme.mutedForeground }}
              >
                {relativeTimeShort(conversation.lastMessageAt)}
              </Text>
            ) : null}
          </Target>
        ))}
        {conversations.data?.conversations.length === 0 && (
          <Text style={{ fontSize: sizes.small, color: theme.mutedForeground }}>
            No conversations with this Bot yet. Start one with New conversation.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
