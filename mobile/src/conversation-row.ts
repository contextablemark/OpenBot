/**
 * What a row in the conversation list says, by the rules OpenBot on the computer uses
 * (app/src/components/app-sidebar/conversations-panel.tsx): its title, whether it has something unread, and the
 * order. It imports nothing, so it can be tested without a phone.
 */

export type RowSource = {
  id: string;
  name: string;
  summary: string | null;
  pinned: boolean;
  lastMessageAt: string | null;
  lastMessageBotId: string | null;
  lastReadAt: string | null;
};

/** The conversation's summary, else its name, else "New conversation". */
export function rowTitle(conversation: RowSource): string {
  return (
    conversation.summary?.trim() ||
    conversation.name.trim() ||
    "New conversation"
  );
}

/** A Bot said something after the person last read it, and it isn't the conversation they have open. */
export function isUnread(
  conversation: RowSource,
  openId: string | undefined,
): boolean {
  if (conversation.id === openId) return false;
  if (conversation.lastMessageBotId === null) return false;
  if (conversation.lastMessageAt === null) return false;
  return (
    conversation.lastReadAt === null ||
    conversation.lastMessageAt > conversation.lastReadAt
  );
}

/** Pinned first, then as the server ordered them. */
export function pinnedFirst<T extends { pinned: boolean }>(
  conversations: readonly T[],
): T[] {
  return [
    ...conversations.filter((one) => one.pinned),
    ...conversations.filter((one) => !one.pinned),
  ];
}
