/**
 * Connect to an OpenBot with an API key: its address and the key, checked against it (./key-check.ts), then, for a
 * person in several organizations, the one the key was made in. Kept as a connection and made the one in use
 * (./key-access.ts). The first screen shows it when nothing is kept; Settings' "Add connection" shows it to add another.
 */
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { saveKeyAccess } from "./key-access";
import { checkKey, type KeyOrganization } from "./key-check";
import { PrimaryButton } from "./material";
import { Target } from "./target";
import { radius, useSizes, useTheme } from "./theme";

export function ConnectForm({ onConnected }: { onConnected?: () => void }) {
  const theme = useTheme();
  const sizes = useSizes();
  const [address, setAddress] = useState("");
  const [key, setKey] = useState("");
  // What the person wants to call it ("Home Desktop"); optional, and editable later in Settings.
  const [name, setName] = useState("");
  /*
   * Shown by default: a long key is pasted or typed once, and the person should see what they entered. Hidden, some
   * keyboards (a headset's) never report the text of a password field until it changes mode.
   */
  const [showKey, setShowKey] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  // A key whose account is in several organizations: the ones to pick from, before anything is kept.
  const [choice, setChoice] = useState<{
    server: string;
    key: string;
    organizations: KeyOrganization[];
  } | null>(null);

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await work();
    } catch (failure) {
      setProblem(
        failure instanceof Error
          ? failure.message
          : "Couldn't connect. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function keep(
    server: string,
    apiKey: string,
    organization: KeyOrganization,
  ) {
    await saveKeyAccess({
      server,
      key: apiKey,
      organization: organization.id,
      ...(organization.name ? { organizationName: organization.name } : {}),
      ...(name.trim() ? { name: name.trim() } : {}),
    });
    setChoice(null);
    onConnected?.();
  }

  const field = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    minHeight: sizes.target,
    fontSize: sizes.row,
    color: theme.foreground,
    backgroundColor: theme.card,
  } as const;

  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: sizes.row,
          color: theme.foreground,
          lineHeight: sizes.row * 1.45,
        }}
      >
        Connect to OpenBot Cloud at https://api.open.bot, or to an OpenBot on
        your network, like the one OpenBot Desktop runs. Make a key in OpenBot
        under Settings, then API keys.
      </Text>
      <TextInput
        accessibilityLabel="OpenBot address"
        placeholder="https://api.open.bot"
        placeholderTextColor={theme.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={address}
        onChangeText={setAddress}
        // A keyboard that didn't report every change still leaves the field's text when editing ends.
        onEndEditing={(event) => setAddress(event.nativeEvent.text)}
        style={field}
      />
      <TextInput
        accessibilityLabel="API key"
        placeholder="obk_…"
        placeholderTextColor={theme.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!showKey}
        value={key}
        onChangeText={setKey}
        onEndEditing={(event) => setKey(event.nativeEvent.text)}
        style={field}
      />
      <TextInput
        accessibilityLabel="Name, optional"
        placeholder="Name (optional), like Home Desktop"
        placeholderTextColor={theme.mutedForeground}
        autoCorrect={false}
        value={name}
        onChangeText={setName}
        onEndEditing={(event) => setName(event.nativeEvent.text)}
        style={field}
      />
      <Target
        onPress={() => setShowKey((shown) => !shown)}
        style={{ alignSelf: "flex-start", paddingHorizontal: 10 }}
      >
        <Text style={{ fontSize: sizes.small, color: theme.mutedForeground }}>
          {showKey ? "Hide key" : "Show key"}
        </Text>
      </Target>
      {problem ? (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: sizes.small, color: theme.destructive }}
        >
          {problem}
        </Text>
      ) : null}
      <PrimaryButton
        label={busy ? "Connecting…" : "Connect"}
        enabled={!busy && Boolean(address.trim()) && Boolean(key.trim())}
        onPress={() => {
          void act(async () => {
            const checked = await checkKey(address, key);
            const [only] = checked.organizations;
            if (checked.organizations.length === 1 && only) {
              await keep(checked.server, checked.key, only);
              return;
            }
            setChoice(checked);
          });
        }}
      />
      {choice && (
        <View style={{ gap: sizes.rowGap }}>
          <Text style={{ fontSize: sizes.row, color: theme.foreground }}>
            Pick the organization you made this key in.
          </Text>
          {choice.organizations.map((organization) => (
            <Target
              key={organization.id}
              disabled={busy}
              accessibilityRole="radio"
              restingBackground={theme.card}
              onPress={() => {
                void act(() => keep(choice.server, choice.key, organization));
              }}
              style={{
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: radius.lg,
              }}
            >
              <Text style={{ fontSize: sizes.row, color: theme.foreground }}>
                {organization.name ?? organization.id}
              </Text>
            </Target>
          ))}
        </View>
      )}
    </View>
  );
}
