import { expect, test } from "bun:test";
import {
  isUnread,
  pinnedFirst,
  type RowSource,
  rowTitle,
} from "../src/conversation-row";

const row = (over: Partial<RowSource> = {}): RowSource => ({
  id: "c1",
  name: "Personal Assistant",
  summary: null,
  pinned: false,
  lastMessageAt: "2026-11-22T10:00:00Z",
  lastMessageBotId: "helper",
  lastReadAt: "2026-11-22T09:00:00Z",
  ...over,
});

test("the title is the summary, else the name, else New conversation", () => {
  expect(rowTitle(row({ summary: "Lisbon plan" }))).toBe("Lisbon plan");
  expect(rowTitle(row())).toBe("Personal Assistant");
  expect(rowTitle(row({ name: " " }))).toBe("New conversation");
});

test("unread when a Bot spoke after the person last read it", () => {
  expect(isUnread(row(), undefined)).toBe(true);
  expect(isUnread(row({ lastReadAt: null }), undefined)).toBe(true);
  expect(isUnread(row({ lastReadAt: "2026-11-22T11:00:00Z" }), undefined)).toBe(
    false,
  );
});

test("never unread when the person spoke last, nothing was said, or it is open", () => {
  expect(isUnread(row({ lastMessageBotId: null }), undefined)).toBe(false);
  expect(isUnread(row({ lastMessageAt: null }), undefined)).toBe(false);
  expect(isUnread(row(), "c1")).toBe(false);
});

test("pinned conversations come first, otherwise the server's order", () => {
  const list = [
    { id: "a", pinned: false },
    { id: "b", pinned: true },
    { id: "c", pinned: false },
  ];
  expect(pinnedFirst(list).map((one) => one.id)).toEqual(["b", "a", "c"]);
});
