import { Redirect, router, useLocalSearchParams } from "expo-router";
import { NewConversationPanel } from "../src/new-conversation-panel";
import { useSignedIn } from "../src/signed-in";

/** A new conversation, full screen on a phone. A Bot's profile can open it with its Bot already picked (`botId`). */
export default function NewConversationScreen() {
  const { botId } = useLocalSearchParams<{ botId?: string }>();
  const { data: session, isPending } = useSignedIn();
  if (!session && !isPending) return <Redirect href="/" />;
  return (
    <NewConversationPanel
      offeredBotId={botId}
      onStarted={(started) =>
        router.replace({
          pathname: "/conversation",
          params: {
            channelId: started.conversationId,
            agentId: started.botId,
            awaiting: started.messageId,
            awaitingText: started.text,
          },
        })
      }
    />
  );
}
