/**
 * The conversation list, as OpenBot on the computer shows it in its sidebar (app/src/components/app-sidebar):
 * "Conversations" with a new-conversation button, a search field, then a row for each conversation (the Bot's orb, the
 * Bot's name and the time, the conversation's title below, and a dot for something unread), pinned first. What else
 * the sidebar holds (Bots) is pinned below the list. On a phone it is Home; on a wider screen it sits beside the open
 * conversation.
 */
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAccount } from "./account";
import { type ConversationSummary, everyBot, ORGANIZATION_ID } from "./api";
import { listConversations } from "./api/generated/conversations/conversations";
import { isUnread, pinnedFirst, rowTitle } from "./conversation-row";
import { MaterialIcon } from "./icons";
import { NewConversationIconButton } from "./material";
import { relativeTimeShort } from "./relative-time";
import { useSignedIn } from "./signed-in";
import { Target } from "./target";
import { radius, type Theme, useSizes, useTheme } from "./theme";
import { useLoad } from "./use-load";

/** A Bot's colour, the same every time for the same Bot. */
const ORB_COLOURS = [
  "#34c48b",
  "#f08a4b",
  "#7480f1",
  "#e0559a",
  "#2bb3d6",
  "#9b6cf0",
];
export function orbColour(botId: string | null | undefined): string {
  let hash = 0;
  for (const char of botId ?? "") hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ORB_COLOURS[Math.abs(hash) % ORB_COLOURS.length] ?? "#7480f1";
}

/** A Bot's orb, as OpenBot draws Bots: a sphere in the Bot's colour, lit from the top left. */
export function Orb({ botId, size }: { botId?: string | null; size: number }) {
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: orbColour(botId),
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: size * 0.14,
          left: size * 0.2,
          width: size * 0.34,
          height: size * 0.26,
          borderRadius: size,
          backgroundColor: "rgba(255,255,255,0.4)",
        }}
      />
    </View>
  );
}

function Row({
  conversation,
  botName,
  botFirst,
  open,
  onPress,
  theme,
}: {
  conversation: ConversationSummary;
  botName: string;
  /** The person's choice (Settings): the Bot's name leads the row, and the conversation's title sits under it. */
  botFirst: boolean;
  open: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const sizes = useSizes();
  const unread = isUnread(conversation, open ? conversation.id : undefined);
  const title = rowTitle(conversation);
  const said = [
    title,
    botName,
    conversation.active ? null : "ended",
    unread ? "unread" : null,
    conversation.busy ? "working" : null,
    conversation.pinned ? "pinned" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Target
      onPress={onPress}
      selected={open}
      accessibilityRole="link"
      accessibilityLabel={said}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radius.lg,
      }}
    >
      <Orb botId={conversation.botIds[0]} size={sizes.target - 12} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={
              botFirst
                ? {
                    flex: 1,
                    fontSize: sizes.row,
                    fontWeight: unread ? "700" : "500",
                    color: theme.foreground,
                  }
                : {
                    flex: 1,
                    fontSize: sizes.small,
                    color: theme.mutedForeground,
                  }
            }
          >
            {botName}
          </Text>
          {conversation.busy ? (
            <Text
              style={{
                fontSize: sizes.small,
                fontWeight: "500",
                color: theme.working,
              }}
            >
              Working
            </Text>
          ) : conversation.lastMessageAt ? (
            <Text
              style={{ fontSize: sizes.small, color: theme.mutedForeground }}
            >
              {relativeTimeShort(conversation.lastMessageAt)}
            </Text>
          ) : null}
          {unread && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.primary,
              }}
            />
          )}
          {conversation.pinned && (
            <Text
              style={{ fontSize: sizes.small, color: theme.mutedForeground }}
            >
              📌
            </Text>
          )}
        </View>
        <Text
          numberOfLines={1}
          style={
            botFirst
              ? { fontSize: sizes.small, color: theme.mutedForeground }
              : {
                  fontSize: sizes.row,
                  fontWeight: unread ? "700" : "500",
                  color: theme.foreground,
                }
          }
        >
          {title}
          {conversation.active ? "" : " (ended)"}
        </Text>
      </View>
    </Target>
  );
}

/** How long typing pauses before the search is sent. */
const SEARCH_PAUSE_MS = 300;

export function ConversationList({
  openId,
  onOpen,
  onNew,
  footer,
  refreshKey,
  bottomInset = 16,
  onFooterHeight,
}: {
  openId?: string;
  onOpen: (conversation: ConversationSummary) => void;
  onNew: () => void;
  /** What is pinned below the list: Bots, and the way to disconnect. */
  footer?: ReactNode;
  /** Changes when the list must be read again now (a conversation was just started). */
  refreshKey?: unknown;
  /** Room left under the last row, for a button floating over the list. */
  bottomInset?: number;
  /** Told how tall the pinned footer is, so a floating button can sit above it. */
  onFooterHeight?: (height: number) => void;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  // Which line of a row leads, as the person set it (Settings, shared with OpenBot on the computer).
  const { data: session } = useSignedIn();
  const { preferences } = useAccount(session?.user.id);
  const botFirst = preferences?.messageListEmphasis === "agent";
  const load = useCallback(
    () => listConversations(ORGANIZATION_ID, { limit: 100 }),
    [],
  );
  // The list changes when somebody speaks somewhere: read every 15 seconds, and on coming back to it.
  const first = useLoad(load, true, { every: 15_000 });
  // Bots' names for the rows; they rarely change, so read once.
  const loadBots = useCallback(
    async () => new Map((await everyBot()).map((bot) => [bot.id, bot.name])),
    [],
  );
  const botNames = useLoad(loadBots);
  const [older, setOlder] = useState<ConversationSummary[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  /*
   * Search, on the server (listConversations `q`: a conversation's name or words). Sent once typing pauses, and only
   * from two characters, as the API asks.
   */
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);
  const searching = query.length >= 2;
  const loadFound = useCallback(
    () => listConversations(ORGANIZATION_ID, { q: query, limit: 50 }),
    [query],
  );
  const found = useLoad(loadFound, searching);
  const { refresh } = first;
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again whenever the key changes
  useEffect(() => {
    void refresh();
  }, [refreshKey, refresh]);
  const nextCursor =
    olderCursor === undefined ? first.data?.nextCursor : olderCursor;
  const shown = searching ? found : first;
  const conversations = searching
    ? (found.data?.conversations ?? [])
    : pinnedFirst(
        Array.from(
          new Map(
            [...(first.data?.conversations ?? []), ...older].map((one) => [
              one.id,
              one,
            ]),
          ).values(),
        ),
      );
  const nameOf = (id: string | undefined) =>
    (id && botNames.data?.get(id)) || "Bot";
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 8, gap: 6 }}>
        <View
          style={{
            minHeight: sizes.target + 8,
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 8,
            paddingRight: 4,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              fontSize: sizes.row,
              fontWeight: "600",
              color: theme.foreground,
            }}
          >
            Conversations
          </Text>
          <NewConversationIconButton onPress={onNew} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: sizes.target,
            paddingHorizontal: 12,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
          }}
        >
          <MaterialIcon
            name="search"
            size={sizes.row + 4}
            color={theme.mutedForeground}
          />
          <TextInput
            accessibilityLabel="Search conversations"
            placeholder="Search…"
            placeholderTextColor={theme.mutedForeground}
            value={typed}
            onChangeText={setTyped}
            onEndEditing={(event) => setTyped(event.nativeEvent.text)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              fontSize: sizes.row,
              color: theme.foreground,
              paddingVertical: 8,
            }}
          />
          {typed ? (
            <Target
              accessibilityLabel="Clear search"
              onPress={() => setTyped("")}
              style={{ minWidth: sizes.target, alignItems: "center" }}
            >
              <MaterialIcon
                name="close"
                size={sizes.row + 4}
                color={theme.mutedForeground}
              />
            </Target>
          ) : null}
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: 8,
          paddingBottom: bottomInset,
          gap: sizes.rowGap,
        }}
      >
        {shown.error ? (
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: sizes.small,
              color: theme.destructive,
              padding: 8,
            }}
          >
            {shown.error}
          </Text>
        ) : null}
        {!shown.data && !shown.error && (
          <ActivityIndicator color={theme.mutedForeground} />
        )}
        {conversations.map((conversation) => (
          <Row
            key={conversation.id}
            conversation={conversation}
            botName={nameOf(conversation.botIds[0])}
            botFirst={botFirst}
            open={conversation.id === openId}
            onPress={() => onOpen(conversation)}
            theme={theme}
          />
        ))}
        {shown.data && conversations.length === 0 && (
          <View style={{ padding: 8, gap: 4 }}>
            <Text style={{ fontSize: sizes.row, color: theme.foreground }}>
              {searching ? "No conversations match" : "No conversations yet"}
            </Text>
            <Text
              style={{ fontSize: sizes.small, color: theme.mutedForeground }}
            >
              {searching
                ? "Try other words."
                : "Start a conversation with a Bot and it shows up here."}
            </Text>
          </View>
        )}
        {!searching && nextCursor && (
          <Target
            disabled={loadingOlder}
            onPress={async () => {
              setLoadingOlder(true);
              try {
                const page = await listConversations(ORGANIZATION_ID, {
                  limit: 100,
                  cursor: nextCursor,
                });
                setOlder((items) => [...items, ...page.conversations]);
                setOlderCursor(page.nextCursor);
              } finally {
                setLoadingOlder(false);
              }
            }}
            style={{ paddingHorizontal: 10 }}
          >
            <Text
              style={{ fontSize: sizes.small, color: theme.mutedForeground }}
            >
              {loadingOlder ? "Loading…" : "Older conversations"}
            </Text>
          </Target>
        )}
      </ScrollView>
      {footer ? (
        <View
          onLayout={(event) =>
            onFooterHeight?.(event.nativeEvent.layout.height)
          }
          style={{
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
