/**
 * Home for somebody signed in, laid out as OpenBot on the computer lays out its default look: on a screen wide enough
 * (a tablet, a foldable open, a headset's window) the conversations sit in a sidebar beside the open one, which is in a
 * rounded panel; with none open, the panel starts a new one. On a phone it is the list alone, each conversation opening
 * full screen, with a floating button for a new one.
 */
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { ConversationList } from "./conversation-list";
import { ConversationPanel } from "./conversation-panel";
import { rowTitle } from "./conversation-row";
import { NewConversationFab } from "./material";
import { NewConversationPanel } from "./new-conversation-panel";
import {
  radius,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
  SPLIT_MIN_WIDTH,
  useTheme,
} from "./theme";

type Open =
  | {
      kind: "conversation";
      id: string;
      title?: string;
      agentId?: string;
      awaiting?: string;
      awaitingText?: string;
    }
  | { kind: "new" };

export function Workspace({ footer }: { footer?: ReactNode }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= SPLIT_MIN_WIDTH;
  const [open, setOpen] = useState<Open>({ kind: "new" });
  // The new-conversation panel Home opens with is there before anybody asked for it: it doesn't take the focus.
  const [askedForNew, setAskedForNew] = useState(false);
  // Read the list again when coming back to it, and when a conversation was just started here.
  const [refreshKey, setRefreshKey] = useState(0);
  // The floating button sits above the pinned footer.
  const [footerHeight, setFooterHeight] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );

  if (!wide)
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ConversationList
          footer={footer}
          onFooterHeight={setFooterHeight}
          refreshKey={refreshKey}
          onOpen={(conversation) =>
            router.push({
              pathname: "/conversation",
              params: {
                channelId: conversation.id,
                title: rowTitle(conversation),
              },
            })
          }
          onNew={() => router.push("/new-conversation")}
          bottomInset={96}
        />
        <NewConversationFab
          bottom={footerHeight + 16}
          onPress={() => router.push("/new-conversation")}
        />
      </View>
    );

  return (
    <View
      style={{ flex: 1, flexDirection: "row", backgroundColor: theme.sidebar }}
    >
      <View
        style={{
          width: Math.max(
            SIDEBAR_MIN_WIDTH,
            Math.min(SIDEBAR_WIDTH, width * 0.4),
          ),
        }}
      >
        <ConversationList
          footer={footer}
          refreshKey={refreshKey}
          openId={open.kind === "conversation" ? open.id : undefined}
          onOpen={(conversation) =>
            setOpen({
              kind: "conversation",
              id: conversation.id,
              title: rowTitle(conversation),
            })
          }
          onNew={() => {
            setAskedForNew(true);
            setOpen({ kind: "new" });
          }}
        />
      </View>
      <View
        style={{
          flex: 1,
          margin: 8,
          marginLeft: 0,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.background,
          overflow: "hidden",
        }}
      >
        {open.kind === "conversation" ? (
          <ConversationPanel
            key={open.id}
            channelId={open.id}
            agentId={open.agentId}
            awaiting={open.awaiting}
            awaitingText={open.awaitingText}
            title={open.title}
            showTitle
          />
        ) : (
          <NewConversationPanel
            key={askedForNew ? "asked" : "home"}
            focusOnOpen={askedForNew}
            onStarted={(started) => {
              setOpen({
                kind: "conversation",
                id: started.conversationId,
                agentId: started.botId,
                awaiting: started.messageId,
                awaitingText: started.text,
              });
              setRefreshKey((key) => key + 1);
            }}
          />
        )}
      </View>
    </View>
  );
}
