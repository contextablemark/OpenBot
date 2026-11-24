/** Draws a Bot's reply from ./markdown.ts, sized and coloured as OpenBot on the computer draws it. */
import { Fragment, useMemo } from "react";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { type Block, type Inline, parseMarkdown } from "./markdown";
import { radius, type Sizes, type Theme, useSizes, useTheme } from "./theme";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const HEADING_SIZES = [22.5, 18.75, 16.875, 16, 16, 16];

/** Only an address on the web opens; a Bot's own files (a relative path) are shown as their name. */
const openable = (href: string) => /^https?:\/\//i.test(href);

function InlineText({ nodes, theme }: { nodes: Inline[]; theme: Theme }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.kind}-${index}`;
        switch (node.kind) {
          case "text":
            return <Fragment key={key}>{node.text}</Fragment>;
          case "strong":
            return (
              <Text key={key} style={{ fontWeight: "700" }}>
                <InlineText nodes={node.children} theme={theme} />
              </Text>
            );
          case "em":
            return (
              <Text key={key} style={{ fontStyle: "italic" }}>
                <InlineText nodes={node.children} theme={theme} />
              </Text>
            );
          case "code":
            return (
              <Text
                key={key}
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  backgroundColor: theme.muted,
                }}
              >
                {` ${node.text} `}
              </Text>
            );
          case "link":
            return (
              <Text
                key={key}
                accessibilityRole={openable(node.href) ? "link" : undefined}
                onPress={
                  openable(node.href)
                    ? () => void Linking.openURL(node.href)
                    : undefined
                }
                style={{ textDecorationLine: "underline" }}
              >
                <InlineText nodes={node.children} theme={theme} />
              </Text>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function BlockView({
  block,
  theme,
  sizes,
}: {
  block: Block;
  theme: Theme;
  sizes: Sizes;
}) {
  const text = {
    fontSize: sizes.message,
    lineHeight: sizes.messageLine,
    color: theme.foreground,
  };
  switch (block.kind) {
    case "heading":
      return (
        <Text
          accessibilityRole="header"
          style={{
            ...text,
            fontSize: HEADING_SIZES[block.level - 1] ?? sizes.message,
            lineHeight:
              (HEADING_SIZES[block.level - 1] ?? sizes.message) * 1.35,
            fontWeight: "600",
          }}
        >
          <InlineText nodes={block.children} theme={theme} />
        </Text>
      );
    case "paragraph":
      return (
        <Text selectable style={text}>
          <InlineText nodes={block.children} theme={theme} />
        </Text>
      );
    case "list":
      return (
        <View style={{ gap: 4 }}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a reply's list never reorders
            <View key={index} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ ...text, minWidth: 18 }}>
                {block.ordered ? `${block.start + index}.` : "•"}
              </Text>
              <Text selectable style={{ ...text, flex: 1 }}>
                <InlineText nodes={item} theme={theme} />
              </Text>
            </View>
          ))}
        </View>
      );
    case "quote":
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: theme.border,
            paddingLeft: 12,
          }}
        >
          <Text selectable style={{ ...text, color: theme.mutedForeground }}>
            <InlineText nodes={block.children} theme={theme} />
          </Text>
        </View>
      );
    case "code":
      return (
        <View
          style={{
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.sidebar,
            padding: 8,
            gap: 6,
          }}
        >
          {block.language ? (
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: theme.mutedForeground,
                paddingHorizontal: 4,
              }}
            >
              {block.language.toLowerCase()}
            </Text>
          ) : null}
          <ScrollView
            horizontal
            style={{
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.background,
            }}
            contentContainerStyle={{ padding: 16 }}
          >
            <Text
              selectable
              style={{
                fontFamily: MONO,
                fontSize: 13,
                lineHeight: 19,
                color: theme.foreground,
              }}
            >
              {block.text}
            </Text>
          </ScrollView>
        </View>
      );
    case "rule":
      return (
        <View
          style={{
            height: 1,
            backgroundColor: theme.border,
            marginVertical: 4,
          }}
        />
      );
    default:
      return null;
  }
}

export function MarkdownView({ source }: { source: string }) {
  const theme = useTheme();
  const sizes = useSizes();
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are re-parsed from the whole text each time
        <BlockView key={index} block={block} theme={theme} sizes={sizes} />
      ))}
    </View>
  );
}
