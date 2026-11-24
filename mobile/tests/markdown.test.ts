import { expect, test } from "bun:test";
import { parseInline, parseMarkdown } from "../src/markdown";
import { relativeTimeShort } from "../src/relative-time";

test("bold, italic, code and links, nested", () => {
  expect(parseInline("2 plus 2 is **4**.")).toEqual([
    { kind: "text", text: "2 plus 2 is " },
    { kind: "strong", children: [{ kind: "text", text: "4" }] },
    { kind: "text", text: "." },
  ]);
  expect(parseInline("[a **plan**](plan.html) and `x_y` _ok_")).toEqual([
    {
      kind: "link",
      href: "plan.html",
      children: [
        { kind: "text", text: "a " },
        { kind: "strong", children: [{ kind: "text", text: "plan" }] },
      ],
    },
    { kind: "text", text: " and " },
    { kind: "code", text: "x_y" },
    { kind: "text", text: " " },
    { kind: "em", children: [{ kind: "text", text: "ok" }] },
  ]);
});

test("an underscore inside a word, or a lone star, is just text", () => {
  expect(parseInline("snake_case_name")).toEqual([
    { kind: "text", text: "snake_case_name" },
  ]);
  expect(parseInline("5 * 3 = 15")).toEqual([
    { kind: "text", text: "5 * 3 = 15" },
  ]);
});

test("blocks: heading, paragraph with a line break, lists, code, quote, rule", () => {
  const blocks = parseMarkdown(
    [
      "## Day 1",
      "Walk the hills.",
      "Lunch at noon.",
      "",
      "- red",
      "- blue",
      "",
      "3. three",
      "4. four",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "> quoted",
      "---",
    ].join("\n"),
  );
  expect(blocks.map((block) => block.kind)).toEqual([
    "heading",
    "paragraph",
    "list",
    "list",
    "code",
    "quote",
    "rule",
  ]);
  expect(blocks[1]).toEqual({
    kind: "paragraph",
    children: [{ kind: "text", text: "Walk the hills.\nLunch at noon." }],
  });
  expect(blocks[3]).toMatchObject({ ordered: true, start: 3 });
  expect(blocks[4]).toEqual({
    kind: "code",
    language: "ts",
    text: "const a = 1;",
  });
});

test("an unclosed fence keeps the rest as code", () => {
  expect(parseMarkdown("```\nline")).toEqual([
    { kind: "code", language: "", text: "line" },
  ]);
});

test("the list's compact time", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  expect(relativeTimeShort("2026-11-22T11:59:30Z", now)).toBe("now");
  expect(relativeTimeShort("2026-11-22T12:00:30Z", now)).toBe("now");
  expect(relativeTimeShort("2026-11-22T11:55:00Z", now)).toBe("5m");
  expect(relativeTimeShort("2026-11-22T09:00:00Z", now)).toBe("3h");
  expect(relativeTimeShort("2026-11-20T12:00:00Z", now)).toBe("2d");
  expect(relativeTimeShort("2026-10-11T12:00:00Z", now)).toBe("6w");
  expect(relativeTimeShort("not a date", now)).toBe("");
});
