/**
 * One conversation, drawn as OpenBot on the computer draws it (app/src/components/channels/chat-transcript.tsx): the
 * person's messages in a muted bubble on the right, the Bot's replies on the left with no bubble, as Markdown, in a
 * column at most 768 wide, and the composer below. Used full screen on a phone (app/conversation.tsx) and beside the
 * conversation list on a wider screen (app/index.tsx).
 *
 * Sending shows the message at once, and the messages are read every moment until the Bot's answer has stopped
 * (./reply.ts): the server answers a send at once and runs the Bot after it.
 */
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  type ScrollViewInstance,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { everyBot, ORGANIZATION_ID } from "./api";
import {
  getConversation,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
} from "./api/generated/conversations/conversations";
import { useDictation } from "./dictation";
import { KeyboardSafe } from "./keyboard-safe";
import { MarkdownView } from "./markdown-view";
import { MicButton, SendButton, Thinking } from "./material";
import { rateLimited } from "./rate-limit";
import { replyState } from "./reply";
import { Target } from "./target";
import {
  radius,
  type Theme,
  TRANSCRIPT_MAX_WIDTH,
  useSizes,
  useTheme,
} from "./theme";
import { useLoad } from "./use-load";

/** How often the messages are read again while a Bot is answering. */
const ANSWER_POLL_MS = 2_000;
/** How long the screen keeps reading that often before it falls back to its usual pace. */
const ANSWER_WAIT_MS = 5 * 60 * 1000;

export type ConversationPanelProps = {
  channelId: string;
  /** The Bot to talk to in a conversation with several, when one was asked for. */
  agentId?: string;
  /** Text to start the composer with. */
  draft?: string;
  /** The id of a message sent just before this opened (New conversation), whose answer it waits for. */
  awaiting?: string;
  /** The first message of a new conversation, shown until the server lists it. */
  awaitingText?: string;
  /** Whether to show the conversation's title as a heading. */
  showTitle?: boolean;
  /** The title the list showed for it (its summary), used for the heading. */
  title?: string;
};

function UserBubble({ text, theme }: { text: string; theme: Theme }) {
  const sizes = useSizes();
  return (
    <View style={{ alignItems: "flex-end" }}>
      <View
        style={{
          maxWidth: "80%",
          backgroundColor: theme.muted,
          borderRadius: radius.xl,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text
          selectable
          style={{
            fontSize: sizes.message,
            lineHeight: sizes.messageLine,
            color: theme.foreground,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

export function ConversationPanel({
  channelId,
  agentId: requestedAgentId,
  draft,
  awaiting: sentFirst,
  awaitingText,
  showTitle = false,
  title,
}: ConversationPanelProps) {
  const theme = useTheme();
  const sizes = useSizes();
  const [agentId, setAgentId] = useState("");
  const [text, setText] = useState(draft ?? "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // The message whose answer is still coming: the messages are read every moment until it is in.
  const [awaiting, setAwaiting] = useState(sentFirst ?? "");
  // What was just sent, shown at once until the server lists it.
  const [sent, setSent] = useState<{ id: string; text: string } | null>(
    sentFirst && awaitingText ? { id: sentFirst, text: awaitingText } : null,
  );
  const scroller = useRef<ScrollViewInstance>(null);
  const sendingNow = useRef(false);
  // How many messages were sent here: the composer takes the focus again after each.
  const [sends, setSends] = useState(0);
  const loadConversation = useCallback(
    () => getConversation(ORGANIZATION_ID, channelId),
    [channelId],
  );
  const conversationLoad = useLoad(loadConversation);
  const conversation = conversationLoad.data?.conversation;
  useEffect(() => {
    if (conversation && !agentId)
      setAgentId(
        requestedAgentId && conversation.botIds.includes(requestedAgentId)
          ? requestedAgentId
          : (conversation.botIds[0] ?? ""),
      );
  }, [conversation, agentId, requestedAgentId]);
  const loadHistory = useCallback(
    () =>
      listConversationMessages(ORGANIZATION_ID, channelId, {
        botId: agentId,
        limit: 200,
      }),
    [channelId, agentId],
  );
  // New messages: every 10 seconds while it is open, and every moment while a Bot is answering (below).
  const history = useLoad(loadHistory, Boolean(agentId), { every: 10_000 });
  // The Bots' names: the conversation names its Bots by id.
  const loadBotNames = useCallback(
    async () => new Map((await everyBot()).map((bot) => [bot.id, bot.name])),
    [],
  );
  const botNames = useLoad(loadBotNames);
  const { refresh: refreshHistory, data: listed } = history;
  useEffect(() => {
    if (!awaiting || !agentId) return;
    const timer = setInterval(() => {
      if (!rateLimited()) void refreshHistory();
    }, ANSWER_POLL_MS);
    const giveUp = setTimeout(() => setAwaiting(""), ANSWER_WAIT_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(giveUp);
    };
  }, [awaiting, agentId, refreshHistory]);
  useEffect(() => {
    if (!listed) return;
    if (sent && listed.messages.some((message) => message.id === sent.id))
      setSent(null);
    if (
      awaiting &&
      replyState(listed.messages, awaiting, agentId) === "settled"
    )
      setAwaiting("");
  }, [awaiting, listed, agentId, sent]);

  // Read, as on the computer: once it opens and each time something new is said while it is open.
  const newest = listed?.messages[0]?.id;
  useEffect(() => {
    if (!newest) return;
    void markConversationRead(ORGANIZATION_ID, channelId).catch(
      () => undefined,
    );
  }, [newest, channelId]);

  // Oldest first, and only what a person reads: not the tool results and notes a Bot's run records beside its reply.
  const messages = (listed?.messages ?? [])
    .filter((message) => message.role === "person" || message.role === "bot")
    .reverse();
  const nameOf = (id: string | null | undefined) =>
    (id && botNames.data?.get(id)) || id || "Bot";
  const severalBots = (conversation?.botIds.length ?? 0) > 1;
  const active = conversation?.active ?? true;
  const canSend =
    Boolean(agentId) && active && !sending && Boolean(text.trim());

  async function send() {
    // A ref, not state: Enter can deliver its submit twice before a re-render, and one message is sent once.
    if (!canSend || sendingNow.current) return;
    sendingNow.current = true;
    const message = text.trim();
    const id = Crypto.randomUUID();
    setSending(true);
    setError("");
    setSent({ id, text: message });
    setText("");
    try {
      await sendConversationMessage(ORGANIZATION_ID, channelId, {
        id,
        text: message,
        botId: agentId,
      });
      setAwaiting(id);
      await refreshHistory();
    } catch (failure) {
      setSent(null);
      setText(message);
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't send your message. Try again.",
      );
    } finally {
      sendingNow.current = false;
      setSending(false);
      setSends((count) => count + 1);
    }
  }

  const column = {
    width: "100%",
    maxWidth: TRANSCRIPT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
  } as const;
  const problem = error || conversationLoad.error || history.error;

  return (
    <KeyboardSafe backgroundColor={theme.background}>
      {(showTitle || severalBots) && (
        <View style={[column, { paddingTop: 12, gap: 8 }]}>
          {showTitle && (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 18.75,
                fontWeight: "600",
                color: theme.foreground,
              }}
            >
              {title || conversation?.name || "Conversation"}
            </Text>
          )}
          {severalBots && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {conversation?.botIds.map((id) => {
                const chosen = id === agentId;
                return (
                  <Target
                    key={id}
                    accessibilityRole="radio"
                    selected={chosen}
                    onPress={() => setAgentId(id)}
                    style={{
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderColor: chosen ? theme.foreground : theme.border,
                      borderWidth: 1,
                    }}
                  >
                    <Text
                      style={{ fontSize: sizes.small, color: theme.foreground }}
                    >
                      {nameOf(id)}
                    </Text>
                  </Target>
                );
              })}
            </View>
          )}
        </View>
      )}
      <ScrollView
        ref={scroller}
        onContentSizeChange={() => scroller.current?.scrollToEnd()}
        // The keyboard lifts the composer and shortens the transcript: keep the latest message in view.
        onLayout={() => scroller.current?.scrollToEnd({ animated: false })}
        style={{ flex: 1 }}
        contentContainerStyle={[column, { paddingVertical: 24, gap: 24 }]}
      >
        {messages.map((message) =>
          message.role === "person" ? (
            <UserBubble key={message.id} text={message.text} theme={theme} />
          ) : (
            <View key={message.id} style={{ gap: 6 }}>
              {severalBots && (
                <Text
                  style={{
                    fontSize: sizes.small,
                    fontWeight: "500",
                    color: theme.mutedForeground,
                  }}
                >
                  {nameOf(message.botId)}
                </Text>
              )}
              {message.text ? (
                <MarkdownView source={message.text} />
              ) : message.toolCalls ? (
                <Text
                  style={{
                    fontSize: sizes.small,
                    color: theme.mutedForeground,
                  }}
                >
                  Using a tool…
                </Text>
              ) : null}
              {message.status === "failed" && (
                <Text
                  style={{ fontSize: sizes.small, color: theme.destructive }}
                >
                  This answer didn't finish. Send your message again.
                </Text>
              )}
              {message.status === "waiting" && (
                <Text style={{ fontSize: sizes.small, color: theme.working }}>
                  {message.reason ??
                    `${nameOf(message.botId)} is waiting for you.`}
                </Text>
              )}
            </View>
          ),
        )}
        {sent && <UserBubble text={sent.text} theme={theme} />}
        {awaiting ? <Thinking /> : null}
        {!listed && !problem && (
          <ActivityIndicator color={theme.mutedForeground} />
        )}
      </ScrollView>
      <View style={[column, { paddingBottom: 16, gap: 8 }]}>
        {problem ? (
          <Text
            accessibilityRole="alert"
            style={{ fontSize: sizes.small, color: theme.destructive }}
          >
            {problem}
          </Text>
        ) : null}
        {!active && (
          <Text style={{ fontSize: sizes.small, color: theme.mutedForeground }}>
            This conversation has ended. Start a new one to keep going.
          </Text>
        )}
        <Composer
          value={text}
          onChange={setText}
          onSend={() => void send()}
          canSend={canSend}
          // Stays editable while sending, so the focus stays in it; ./sendingNow keeps one send at a time.
          editable={active}
          theme={theme}
          focusKey={`${channelId}:${sends}`}
        />
      </View>
    </KeyboardSafe>
  );
}

/** The rounded box with the text and the round send button, as on the computer. */
export function Composer({
  value,
  onChange,
  onSend,
  canSend,
  editable,
  placeholder = "Ask anything",
  theme,
  focusKey,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  editable: boolean;
  placeholder?: string;
  theme: Theme;
  /**
   * The text field takes the focus whenever this changes: when a conversation opens, and after each send, so the
   * person (or a keyboard) can type straight away. A moment after, so the window is in front and laid out first.
   */
  focusKey?: unknown;
}) {
  const sizes = useSizes();
  const input = useRef<TextInputInstance>(null);
  const dictation = useDictation({ value, onChange });
  // Sending stops dictation: what was said so far is what goes.
  const send = () => {
    // Sending ends dictation outright: what is in the box is what goes, and nothing heard later refills it.
    dictation.cancel();
    onSend();
  };
  useEffect(() => {
    if (focusKey === undefined) return;
    const timer = setTimeout(() => input.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [focusKey]);
  return (
    <View style={{ gap: 6 }}>
      {dictation.problem ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: sizes.small, color: theme.destructive }}
        >
          {dictation.problem}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: radius.composer,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          padding: 12,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <TextInput
          ref={input}
          accessibilityLabel="Message"
          multiline
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={dictation.listening ? "Listening…" : placeholder}
          placeholderTextColor={theme.mutedForeground}
          // Enter sends, as on the computer.
          submitBehavior="submit"
          onSubmitEditing={send}
          style={{
            flex: 1,
            minHeight: sizes.target - 8,
            maxHeight: 200,
            fontSize: sizes.message,
            color: theme.foreground,
            paddingVertical: 8,
            textAlignVertical: "top",
          }}
        />
        {dictation.available ? (
          <MicButton
            listening={dictation.listening}
            level={dictation.level}
            enabled={editable}
            onPress={dictation.toggle}
          />
        ) : null}
        <SendButton enabled={canSend} onPress={send} />
      </View>
    </View>
  );
}
