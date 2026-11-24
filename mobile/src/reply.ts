/**
 * Whether the Bot has finished answering a message the person sent from this phone, read from the conversation's
 * messages (newest first, as the API lists them). The server answers a send at once and runs the Bot after it, so the
 * conversation screen reads the messages again and again until this says the answer is in. It imports nothing, so it
 * can be tested without a phone.
 */

/** The fields of a message this reads. */
export type ListedMessage = {
  id: string;
  role: string;
  status: string;
  botId?: string | null;
};

/** Where a Bot's reply is still being made. Anything else (completed, failed, waiting for the person) has stopped. */
const UNDER_WAY = new Set(["queued", "running"]);

/**
 * "settled" once the Bot's newest reply after the sent message has stopped: it finished, failed, or is waiting for
 * the person. "pending" while there is none yet or it is still queued or running. A status this app doesn't know yet
 * counts as stopped, so a newer server never leaves the phone asking forever. `sentId` is the id the phone sent the
 * message under; until the list carries it, the message isn't in yet and the answer is "pending".
 */
export function replyState(
  newestFirst: readonly ListedMessage[],
  sentId: string,
  botId?: string,
): "pending" | "settled" {
  const sentAt = newestFirst.findIndex((message) => message.id === sentId);
  if (sentAt === -1) return "pending";
  const reply = newestFirst
    .slice(0, sentAt)
    .find(
      (message) =>
        message.role === "bot" &&
        (botId === undefined || !message.botId || message.botId === botId),
    );
  if (!reply || UNDER_WAY.has(reply.status)) return "pending";
  return "settled";
}
