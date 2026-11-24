import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { savePreferences, useAccount, versionLabel } from "../src/account";
import { authClient, serverUrl } from "../src/auth";
import { Avatar } from "../src/avatar";
import {
  connectionLabel,
  removeConnection,
  renameConnection,
  switchConnection,
  useKeyAccess,
} from "../src/key-access";
import { unregisterPush } from "../src/notifications";
import { RELEASE } from "../src/release";
import { useSignedIn } from "../src/signed-in";
import { Target } from "../src/target";
import {
  radius,
  type Theme,
  TRANSCRIPT_MAX_WIDTH,
  useSizes,
  useTheme,
} from "../src/theme";

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  const sizes = useSizes();
  return (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: sizes.small,
          fontWeight: "600",
          color: theme.mutedForeground,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          padding: 6,
          gap: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Settings of note for this app: the account, how conversations are listed, check-ins, the connection, versions. */
export default function SettingsScreen() {
  const theme = useTheme();
  const sizes = useSizes();
  const { data: session, isPending } = useSignedIn();
  const { access, connections } = useKeyAccess();
  // The connection being renamed, and its name as typed so far.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // The connection whose Remove was pressed once: a second press within a few seconds removes it.
  const [confirming, setConfirming] = useState<string | null>(null);
  const { me, preferences, error } = useAccount(session?.user.id);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  if (!session && !isPending) return <Redirect href="/" />;
  const person = me?.person;
  const name = person?.name || person?.email || "";

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setProblem("");
    try {
      await work();
    } catch (failure) {
      setProblem(
        failure instanceof Error
          ? failure.message
          : "Couldn't save that. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveName(id: string) {
    await act(() => renameConnection(id, draft));
    setEditing(null);
  }

  const text = { fontSize: sizes.row, color: theme.foreground } as const;
  const note = { fontSize: sizes.small, color: theme.mutedForeground } as const;
  const emphasis = preferences?.messageListEmphasis ?? "thread";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        width: "100%",
        maxWidth: TRANSCRIPT_MAX_WIDTH,
        alignSelf: "center",
        padding: 16,
        gap: 20,
      }}
    >
      {error || problem ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: sizes.small, color: theme.destructive }}
        >
          {problem || error}
        </Text>
      ) : null}

      <Section title="Account" theme={theme}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 10,
            minHeight: sizes.target,
          }}
        >
          <Avatar
            name={person?.name}
            email={person?.email}
            size={sizes.target - 8}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...text, fontWeight: "600" }}>{name}</Text>
            {person?.name && person.email ? (
              <Text style={note}>{person.email}</Text>
            ) : null}
          </View>
        </View>
      </Section>

      <Section title="Conversation list" theme={theme}>
        {(
          [
            {
              value: "thread",
              label: "Conversation first",
              hint: "Each row leads with what the conversation is about.",
            },
            {
              value: "agent",
              label: "Bot first",
              hint: "Each row leads with the Bot you're talking to.",
            },
          ] as const
        ).map((choice) => {
          const chosen = emphasis === choice.value;
          return (
            <Target
              key={choice.value}
              accessibilityRole="radio"
              selected={chosen}
              disabled={busy || !preferences}
              onPress={() => {
                if (chosen) return;
                void act(() =>
                  savePreferences({ messageListEmphasis: choice.value }),
                );
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: chosen ? theme.ring : theme.mutedForeground,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {chosen ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: theme.ring,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={text}>{choice.label}</Text>
                <Text style={note}>{choice.hint}</Text>
              </View>
            </Target>
          );
        })}
        <Text style={{ ...note, paddingHorizontal: 10, paddingBottom: 6 }}>
          OpenBot on your computer uses the same setting.
        </Text>
      </Section>

      <Section title="Check-ins" theme={theme}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: sizes.target,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={text}>Bots check in with you</Text>
            <Text style={note}>
              Turn this off to stop every Bot's check-ins, whatever each Bot is
              set to.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Bots check in with you"
            value={preferences?.proactive !== "off"}
            disabled={busy || !preferences}
            trackColor={{ true: theme.ring, false: theme.border }}
            thumbColor="#ffffff"
            onValueChange={(on) => {
              void act(() => savePreferences({ proactive: on ? "on" : "off" }));
            }}
          />
        </View>
      </Section>

      {session?.viaKey ? (
        <Section title="Connections" theme={theme}>
          {connections.map((connection) => {
            const inUse = connection.id === access?.id;
            const label = connectionLabel(connection);
            if (editing === connection.id)
              return (
                <View
                  key={connection.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingLeft: 10,
                  }}
                >
                  <TextInput
                    accessibilityLabel={`Name for ${label}`}
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                    onEndEditing={(event) => setDraft(event.nativeEvent.text)}
                    placeholder={connectionLabel({ ...connection, name: "" })}
                    placeholderTextColor={theme.mutedForeground}
                    returnKeyType="done"
                    onSubmitEditing={() => void saveName(connection.id)}
                    style={{
                      flex: 1,
                      minHeight: sizes.target,
                      fontSize: sizes.row,
                      color: theme.foreground,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.ring,
                    }}
                  />
                  <Target
                    disabled={busy}
                    onPress={() => void saveName(connection.id)}
                    style={{ paddingHorizontal: 12 }}
                  >
                    <Text style={{ ...note, color: theme.ring }}>Save</Text>
                  </Target>
                  <Target
                    onPress={() => setEditing(null)}
                    style={{ paddingHorizontal: 12 }}
                  >
                    <Text style={note}>Cancel</Text>
                  </Target>
                </View>
              );
            return (
              <View
                key={connection.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Target
                  accessibilityRole="radio"
                  accessibilityLabel={inUse ? `${label}, in use` : label}
                  selected={inUse}
                  disabled={busy}
                  onPress={() => {
                    if (inUse) return;
                    void act(async () => {
                      await switchConnection(connection.id);
                      router.dismissTo("/");
                    });
                  }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: inUse ? theme.ring : theme.mutedForeground,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {inUse ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: theme.ring,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text style={{ ...text, flex: 1 }} numberOfLines={1}>
                    {label}
                  </Text>
                </Target>
                <Target
                  accessibilityLabel={`Rename ${label}`}
                  disabled={busy}
                  onPress={() => {
                    setDraft(connection.name ?? "");
                    setEditing(connection.id);
                  }}
                  style={{ paddingHorizontal: 12 }}
                >
                  <Text style={note}>Rename</Text>
                </Target>
                <Target
                  accessibilityLabel={
                    confirming === connection.id
                      ? `Confirm removing ${label}`
                      : `Remove ${label}`
                  }
                  disabled={busy}
                  onPress={() => {
                    // Asked twice: a key press that lands here by accident (after renaming) removes nothing.
                    if (confirming !== connection.id) {
                      setConfirming(connection.id);
                      setTimeout(
                        () =>
                          setConfirming((now) =>
                            now === connection.id ? null : now,
                          ),
                        4000,
                      );
                      return;
                    }
                    setConfirming(null);
                    void act(async () => {
                      await removeConnection(connection.id);
                      router.dismissTo("/");
                    });
                  }}
                  style={{ paddingHorizontal: 12 }}
                >
                  <Text style={{ ...note, color: theme.destructive }}>
                    {confirming === connection.id ? "Confirm remove" : "Remove"}
                  </Text>
                </Target>
              </View>
            );
          })}
          <Target
            disabled={busy}
            onPress={() => router.push("/connect")}
            style={{ paddingHorizontal: 10 }}
          >
            <Text style={{ ...text, color: theme.ring }}>Add connection</Text>
          </Target>
          <Text style={{ ...note, paddingHorizontal: 10, paddingBottom: 6 }}>
            OpenBot opens in the connection you used last.
          </Text>
        </Section>
      ) : (
        <Section title="Connection" theme={theme}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 8, gap: 2 }}>
            <Text style={text}>{serverUrl}</Text>
            <Text style={note}>Signed in to OpenBot.</Text>
          </View>
          <Target
            disabled={busy}
            onPress={() => {
              void act(async () => {
                await unregisterPush();
                const result = await authClient.signOut();
                if (result.error)
                  throw new Error(result.error.message ?? "Couldn't sign out.");
                router.dismissTo("/");
              });
            }}
            style={{ paddingHorizontal: 10 }}
          >
            <Text style={{ ...text, color: theme.destructive }}>Sign out</Text>
          </Target>
        </Section>
      )}

      <Section title="About" theme={theme}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
          <View style={{ flexDirection: "row" }}>
            <Text style={{ ...text, flex: 1 }}>This app</Text>
            <Text style={note}>
              {versionLabel(RELEASE) || "Development build"}
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Text style={{ ...text, flex: 1 }}>OpenBot</Text>
            <Text style={note}>{versionLabel(me?.openbotVersion) || "—"}</Text>
          </View>
        </View>
      </Section>
    </ScrollView>
  );
}
