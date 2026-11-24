/**
 * Start a conversation with a Bot, the way OpenBot on the computer does (app/src/lib/channels/start.ts): pick the Bot,
 * write the first message, and on send the conversation is made and the message sent in it. A conversation whose first
 * message didn't send is removed again, so nobody is left with an empty one. The first Bot is chosen to begin with.
 */
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { everyBot, ORGANIZATION_ID } from "./api";
import {
  createConversation,
  deleteConversation,
  sendConversationMessage,
} from "./api/generated/conversations/conversations";
import { Orb } from "./conversation-list";
import { Composer } from "./conversation-panel";
import { KeyboardSafe } from "./keyboard-safe";
import { Target } from "./target";
import { radius, TRANSCRIPT_MAX_WIDTH, useSizes, useTheme } from "./theme";
import { useLoad } from "./use-load";

export type Started = {
  conversationId: string;
  botId: string;
  messageId: string;
  text: string;
};

export function NewConversationPanel({
  offeredBotId,
  onStarted,
  focusOnOpen = true,
}: {
  offeredBotId?: string;
  /**
   * Whether the composer takes the focus as this opens. Home's panel, there before the person chose anything, doesn't:
   * on a phone that would put the keyboard up as the app opens. It does once they pick a Bot.
   */
  focusOnOpen?: boolean;
  onStarted: (started: Started) => void;
}) {
  const theme = useTheme();
  const sizes = useSizes();
  const load = useCallback(() => everyBot(), []);
  const bots = useLoad(load);
  const [botId, setBotId] = useState(offeredBotId ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Set once the person picks a Bot here: from then on, picking puts them in the composer.
  const [picking, setPicking] = useState(false);
  const startingNow = useRef(false);
  const [error, setError] = useState("");
  // The first Bot is chosen until the person picks another: one less step to start, as the list leads with it.
  const firstBot = bots.data?.[0]?.id;
  useEffect(() => {
    if (firstBot && !botId) setBotId(firstBot);
  }, [firstBot, botId]);
  const picked = bots.data?.find((bot) => bot.id === botId);
  const canStart = Boolean(botId) && Boolean(text.trim()) && !busy;

  async function start() {
    // A ref, not state: Enter can deliver its submit twice before a re-render, and one conversation is started once.
    if (!canStart || startingNow.current) return;
    startingNow.current = true;
    const message = text.trim();
    setBusy(true);
    setError("");
    try {
      const made = await createConversation(ORGANIZATION_ID, {
        botIds: [botId],
      });
      const conversationId = made.conversation.id;
      const messageId = Crypto.randomUUID();
      try {
        await sendConversationMessage(ORGANIZATION_ID, conversationId, {
          id: messageId,
          text: message,
          botId,
        });
      } catch (failure) {
        // Removed only if nothing was ever said in it. The send's own failure is what the person sees.
        await deleteConversation(ORGANIZATION_ID, conversationId, {
          discardFailedStart: true,
        }).catch(() => undefined);
        throw failure;
      }
      onStarted({ conversationId, botId, messageId, text: message });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't start the conversation. Try again.",
      );
    } finally {
      startingNow.current = false;
      setBusy(false);
    }
  }

  const column = {
    width: "100%",
    maxWidth: TRANSCRIPT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
  } as const;
  return (
    <KeyboardSafe backgroundColor={theme.background}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[column, { paddingVertical: 24, gap: 12 }]}
      >
        <Text
          style={{
            fontSize: 22.5,
            fontWeight: "600",
            color: theme.foreground,
          }}
        >
          {picked ? `Talk to ${picked.name}` : "Who do you want to talk to?"}
        </Text>
        {(bots.data?.length ?? 0) > 1 &&
          bots.data?.map((bot) => {
            const chosen = bot.id === botId;
            return (
              <Target
                key={bot.id}
                accessibilityRole="radio"
                accessibilityLabel={
                  bot.title ? `${bot.name}, ${bot.title}` : bot.name
                }
                selected={chosen}
                disabled={busy}
                onPress={() => {
                  setPicking(true);
                  setBotId(bot.id);
                }}
                restingBackground={chosen ? theme.card : "transparent"}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: chosen ? theme.ring : theme.border,
                }}
              >
                <Orb botId={bot.id} size={sizes.target - 16} />
                <View style={{ flex: 1 }}>
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
                      style={{
                        fontSize: sizes.small,
                        color: theme.mutedForeground,
                      }}
                    >
                      {bot.title}
                    </Text>
                  ) : null}
                </View>
              </Target>
            );
          })}
        {picked?.title && (bots.data?.length ?? 0) === 1 ? (
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
            {picked.title}
          </Text>
        ) : null}
        {bots.data?.length === 0 && (
          <Text style={{ fontSize: 14, color: theme.mutedForeground }}>
            No Bots yet. Create one in OpenBot on your computer.
          </Text>
        )}
        {error || bots.error ? (
          <Text
            accessibilityRole="alert"
            style={{ fontSize: 13, color: theme.destructive }}
          >
            {error || bots.error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[column, { paddingBottom: 16 }]}>
        <Composer
          value={text}
          onChange={setText}
          onSend={() => void start()}
          canSend={canStart}
          editable={!busy}
          focusKey={focusOnOpen || picking ? botId || "none" : undefined}
          placeholder={picked ? `Message ${picked.name}` : "Ask anything"}
          theme={theme}
        />
      </View>
    </KeyboardSafe>
  );
}
