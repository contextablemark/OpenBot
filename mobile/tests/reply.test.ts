import { expect, test } from "bun:test";
import { type ListedMessage, replyState } from "../src/reply";

const sent: ListedMessage = {
  id: "sent-1",
  role: "person",
  status: "completed",
};
const bot = (status: string, id = `bot-${status}`): ListedMessage => ({
  id,
  role: "bot",
  status,
  botId: "helper",
});

test("pending until the sent message is listed", () => {
  expect(replyState([bot("completed", "old")], "sent-1")).toBe("pending");
});

test("pending until a reply comes after the sent message", () => {
  expect(replyState([sent, bot("completed", "old")], "sent-1")).toBe("pending");
});

test("pending while the reply is queued or running", () => {
  expect(replyState([bot("queued"), sent], "sent-1")).toBe("pending");
  expect(replyState([bot("running"), sent], "sent-1")).toBe("pending");
});

test("settled once the reply finished, failed, or waits for the person", () => {
  for (const status of ["completed", "failed", "waiting"])
    expect(replyState([bot(status), sent], "sent-1")).toBe("settled");
});

test("an unknown status counts as stopped", () => {
  expect(replyState([bot("archived"), sent], "sent-1")).toBe("settled");
});

test("reads the newest reply, past tool steps", () => {
  const tool: ListedMessage = { id: "t", role: "tool", status: "completed" };
  expect(
    replyState(
      [bot("running", "b2"), tool, bot("completed", "b1"), sent],
      "sent-1",
    ),
  ).toBe("pending");
  expect(
    replyState(
      [bot("completed", "b2"), tool, bot("completed", "b1"), sent],
      "sent-1",
    ),
  ).toBe("settled");
});

test("only the Bot it was sent to counts", () => {
  const other = { ...bot("completed"), botId: "someone-else" };
  expect(replyState([other, sent], "sent-1", "helper")).toBe("pending");
  expect(replyState([other, sent], "sent-1")).toBe("settled");
});
