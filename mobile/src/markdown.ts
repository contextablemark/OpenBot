/**
 * Enough Markdown for a Bot's replies to read as they do on the computer, where they are rendered with Streamdown
 * (app/src/lib/markdown.tsx): headings, paragraphs, bulleted and numbered lists, quotes, rules, fenced code, and inline
 * bold, italic, code and links. A newline inside a paragraph stays a line break, as there. Anything else is shown as
 * the text it is. It imports nothing, so it can be tested without a phone; ./markdown-view.tsx draws it.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "heading"; level: number; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { kind: "quote"; children: Inline[] }
  | { kind: "code"; language: string; text: string }
  | { kind: "rule" };

const FENCE = /^(\s*)(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        kind: "paragraph",
        children: parseInline(paragraph.join("\n")),
      });
      paragraph = [];
    }
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[2] ?? "```";
      const body: string[] = [];
      index++;
      while (
        index < lines.length &&
        !(lines[index] ?? "").trim().startsWith(marker)
      ) {
        body.push(lines[index] ?? "");
        index++;
      }
      blocks.push({
        kind: "code",
        language: fence[3] ?? "",
        text: body.join("\n"),
      });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: (heading[1] ?? "#").length,
        children: parseInline(heading[2] ?? ""),
      });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = !bullet;
      const items: Inline[][] = [];
      const start = numbered ? Number(numbered[1]) : 1;
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const item = ordered ? NUMBERED.exec(current) : BULLET.exec(current);
        if (!item) break;
        items.push(parseInline((ordered ? item[2] : item[1]) ?? ""));
        index++;
      }
      index--;
      blocks.push({ kind: "list", ordered, start, items });
      continue;
    }
    const quote = QUOTE.exec(line);
    if (quote) {
      flush();
      const quoted: string[] = [];
      while (index < lines.length) {
        const current = QUOTE.exec(lines[index] ?? "");
        if (!current) break;
        quoted.push(current[1] ?? "");
        index++;
      }
      index--;
      blocks.push({ kind: "quote", children: parseInline(quoted.join("\n")) });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Inline marks, nested where they are: `**bold _and italic_**`, `[a **link**](url)`. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let plain = "";
  const push = (node: Inline) => {
    if (plain) out.push({ kind: "text", text: plain });
    plain = "";
    out.push(node);
  };
  let index = 0;
  while (index < text.length) {
    const rest = text.slice(index);
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      push({ kind: "code", text: code[1] ?? "" });
      index += code[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      push({
        kind: "link",
        href: link[2] ?? "",
        children: parseInline(link[1] ?? ""),
      });
      index += link[0].length;
      continue;
    }
    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (strong) {
      push({ kind: "strong", children: parseInline(strong[2] ?? "") });
      index += strong[0].length;
      continue;
    }
    const em = /^(\*|_)(?=\S)([\s\S]*?\S)\1(?!\1)/.exec(rest);
    // An underscore inside a word (snake_case) is not emphasis.
    const wordBefore = /\w$/.test(plain) && rest.startsWith("_");
    if (em && !wordBefore) {
      push({ kind: "em", children: parseInline(em[2] ?? "") });
      index += em[0].length;
      continue;
    }
    plain += text[index];
    index++;
  }
  if (plain) out.push({ kind: "text", text: plain });
  return out;
}
