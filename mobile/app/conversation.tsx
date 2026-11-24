import { Redirect, useLocalSearchParams } from "expo-router";
import { ConversationPanel } from "../src/conversation-panel";
import { useSignedIn } from "../src/signed-in";

/** One conversation, full screen on a phone. A wider screen shows it beside the list on Home instead. */
export default function ConversationScreen() {
  const { channelId, agentId, draft, awaiting, awaitingText, title } =
    useLocalSearchParams<{
      channelId: string;
      agentId?: string;
      /** A Bot profile's "Add routine" arrives with its sentence started for the person to finish. */
      draft?: string;
      /** The id of a message sent just before this opened (New conversation), whose answer it waits for. */
      awaiting?: string;
      awaitingText?: string;
      title?: string;
    }>();
  const { data: session, isPending } = useSignedIn();
  if (!session && !isPending) return <Redirect href="/" />;
  if (!channelId) return <Redirect href="/" />;
  return (
    <ConversationPanel
      key={channelId}
      channelId={channelId}
      agentId={agentId}
      draft={draft}
      awaiting={awaiting}
      awaitingText={awaitingText}
      title={title}
      showTitle
    />
  );
}
