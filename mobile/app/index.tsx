import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { useAccount, versionLabel } from "../src/account";
import {
  chooseOrganization,
  ORGANIZATION_ID,
  organizationChoices,
  readDeployment,
} from "../src/api";
import { getCompanySignIn } from "../src/api/generated/people/people";
import {
  authClient,
  openInSystemBrowser,
  renewHostedSignIn,
  serverUrl,
  signIn,
  signInConfigured,
  signInEnterprise,
} from "../src/auth";
import { Avatar } from "../src/avatar";
import { HELD_OUT, linkButtons } from "../src/company-sign-in";
import { companySignInTicket } from "../src/company-sign-in-ticket";
import { ConnectForm } from "../src/connect-form";
import { homeView } from "../src/home-view";
import { MaterialIcon } from "../src/icons";
import { forgetKeyAccess, useKeyAccess } from "../src/key-access";
import { linkCompanyAccount, onCompanyLinked } from "../src/link-company";
import { registerPush, unregisterPush } from "../src/notifications";
import { onOrganizationGone } from "../src/organization-gone";
import { onRenewalNeedsClick } from "../src/renewal";
import { useSignedIn } from "../src/signed-in";
import { Target } from "../src/target";
import { useSizes, useTheme } from "../src/theme";
import { useLoad } from "../src/use-load";
import { Workspace } from "../src/workspace";

export default function Home() {
  const { data: session, isPending } = useSignedIn();
  const theme = useTheme();
  const sizes = useSizes();
  // The person and the OpenBot release, for the footer.
  const account = useAccount(session?.user.id);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const { access } = useKeyAccess();
  const [busy, setBusy] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset for whoever is signed in now, not the previous person
  useEffect(() => {
    setPushRegistered(false);
  }, [session?.user.id]);
  const loadOptions = useCallback(
    // The API's `deployment`, which answers before anybody has signed in: asked of the organization every install has.
    () => readDeployment(false),
    [],
  );
  // Only once the session has answered, and only for somebody signed out: it is the signed-out screen's.
  const options = useLoad(
    loadOptions,
    signInConfigured && !session && !isPending,
  );
  // A failure of that read belongs to the signed-out screen, and is not shown once somebody is signed in.
  const optionsError = session ? undefined : options.error;
  // The person's organizations and the one they work in; picking another reads everything below again.
  const loadOrganizations = useCallback(() => organizationChoices(), []);
  const organizations = useLoad(loadOrganizations, Boolean(session));
  const workingIn = organizations.data?.currentId;
  const inNone =
    homeView(Boolean(session), organizations.error) === "in-no-organization";
  /*
   * Whether the organization they work in holds them out until they sign in through their company, and the providers
   * that let them. Answered even while it holds them out; read again wherever they work now.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again for whoever is signed in now, and wherever they work now
  const loadCompanySignIn = useCallback(
    () => getCompanySignIn(ORGANIZATION_ID, "me"),
    [session?.user.id, workingIn],
  );
  // Company sign-in is a signed-in person's: an API key never has it.
  const companySignIn = useLoad(
    loadCompanySignIn,
    Boolean(session) && !session?.viaKey && !inNone,
  );
  // In no organization here: nothing that acts on one is offered, and nothing is asked of one. Held out of one: the
  // way in, and their other organizations.
  const view = homeView(
    Boolean(session),
    organizations.error,
    companySignIn.data,
  );
  /*
   * The organization they work in went away while the app was open (they were removed, or it was deleted): their
   * organizations are read again, and everything below follows the one they work in now.
   */
  const { refresh: refreshOrganizations } = organizations;
  /*
   * A hosted OpenBot's sign-in the phone couldn't renew by itself: "Sign in again" opens it, and what is on Home is
   * read again after.
   */
  const [renewal, setRenewal] = useState<string | null>(null);
  useEffect(() => onRenewalNeedsClick(setRenewal), []);
  /*
   * Back from linking the company account by OpenBot's deep link, outside the browser's session: the company sign-in
   * is read again, so a hold that lifted leaves the held state.
   */
  const { refresh: refreshCompanySignIn } = companySignIn;
  useEffect(
    () =>
      onCompanyLinked(() => {
        void refreshOrganizations();
        void refreshCompanySignIn();
      }),
    [refreshOrganizations, refreshCompanySignIn],
  );
  useEffect(
    () =>
      onOrganizationGone(() => {
        void refreshOrganizations();
      }),
    [refreshOrganizations],
  );
  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  const signOutButton = session?.viaKey ? (
    <Button
      disabled={busy}
      title="Disconnect"
      onPress={() => {
        void act(async () => {
          await forgetKeyAccess();
        });
      }}
    />
  ) : (
    <Button
      disabled={busy}
      title="Sign out"
      onPress={() => {
        void act(async () => {
          await unregisterPush();
          const result = await authClient.signOut();
          if (result.error)
            throw new Error(result.error.message ?? "Could not sign out.");
        });
      }}
    />
  );
  if (session && view === "working") {
    const navigation = [{ label: "Bots", href: "/bots" }] as const;
    const several = (organizations.data?.organizations.length ?? 0) > 1;
    const accountName =
      account.me?.person.name || account.me?.person.email || "";
    const version = versionLabel(account.me?.openbotVersion);
    const problem = error || organizations.error;
    return (
      <Workspace
        // A new connection or organization is another account: everything below starts afresh.
        key={`${session.user.id}:${workingIn ?? "none"}`}
        footer={
          <View style={{ gap: sizes.rowGap }}>
            {problem ? (
              <Text
                accessibilityRole="alert"
                style={{
                  fontSize: sizes.small,
                  color: theme.destructive,
                  paddingHorizontal: 12,
                }}
              >
                {problem}
              </Text>
            ) : null}
            {renewal ? (
              <Target
                disabled={busy}
                onPress={() => {
                  void act(async () => {
                    await renewHostedSignIn(renewal);
                    setRenewal(null);
                    await refreshOrganizations();
                  });
                }}
                style={{ paddingHorizontal: 10 }}
              >
                <Text style={{ fontSize: sizes.small, color: theme.working }}>
                  Your sign-in needs renewing. Sign in again
                </Text>
              </Target>
            ) : null}
            {several &&
              organizations.data?.organizations.map((organization) => {
                const current = organization.id === workingIn;
                return (
                  <Target
                    key={organization.id}
                    accessibilityRole="radio"
                    selected={current}
                    disabled={busy}
                    onPress={() => {
                      if (current) return;
                      void act(async () => {
                        await chooseOrganization(organization.id);
                        setPushRegistered(false);
                        await organizations.refresh();
                      });
                    }}
                    style={{ paddingHorizontal: 10 }}
                  >
                    <Text
                      style={{ fontSize: sizes.small, color: theme.foreground }}
                    >
                      {current ? "✓ " : ""}
                      {organization.name ?? organization.id}
                    </Text>
                  </Target>
                );
              })}
            {navigation.map((item) => (
              <Target
                key={item.href}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.href)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 14,
                  paddingHorizontal: 14,
                }}
              >
                <MaterialIcon
                  name="bolt"
                  size={sizes.row + 6}
                  color={theme.foreground}
                />
                <Text style={{ fontSize: sizes.row, color: theme.foreground }}>
                  {item.label}
                </Text>
              </Target>
            ))}
            {!session.viaKey && (
              <Target
                disabled={busy || pushRegistered}
                onPress={() => {
                  void act(async () => {
                    await registerPush();
                    setPushRegistered(true);
                  });
                }}
                style={{ paddingHorizontal: 14 }}
              >
                <Text
                  style={{
                    fontSize: sizes.small,
                    color: theme.mutedForeground,
                  }}
                >
                  {pushRegistered
                    ? "Notifications on"
                    : "Turn on notifications"}
                </Text>
              </Target>
            )}
            <Target
              accessibilityRole="link"
              accessibilityLabel={`${accountName || "Account"}, settings${version ? `, OpenBot ${version}` : ""}`}
              onPress={() => router.push("/settings")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 12,
                paddingHorizontal: 10,
              }}
            >
              <Avatar
                name={account.me?.person.name}
                email={account.me?.person.email}
                size={sizes.target - 16}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: sizes.row,
                  color: theme.foreground,
                }}
              >
                {accountName}
              </Text>
              {version ? (
                <Text
                  style={{
                    fontSize: sizes.small,
                    color: theme.mutedForeground,
                  }}
                >
                  {version}
                </Text>
              ) : null}
            </Target>
          </View>
        }
      />
    );
  }
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Text
        style={{ fontSize: 24, fontWeight: "600", color: theme.foreground }}
      >
        {session?.viaKey
          ? "OpenBot"
          : session
            ? `Welcome, ${session.user.name ?? session.user.email}`
            : "Sign in to OpenBot"}
      </Text>
      <Text style={{ color: theme.foreground }}>
        {access?.server ?? serverUrl}
      </Text>
      {(view === "working" || view === "held-out") &&
        !organizations.error &&
        (organizations.data?.organizations.length ?? 0) > 1 && (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: theme.foreground,
              }}
            >
              Organization
            </Text>
            {organizations.data?.organizations.map((organization) => {
              const current = organization.id === workingIn;
              return (
                <Button
                  key={organization.id}
                  accessibilityState={{ selected: current }}
                  disabled={busy || current}
                  title={`${current ? "✓ " : ""}${organization.name ?? organization.id}`}
                  onPress={() => {
                    void act(async () => {
                      await chooseOrganization(organization.id);
                      setPushRegistered(false);
                      await organizations.refresh();
                    });
                  }}
                />
              );
            })}
          </View>
        )}
      {(error || optionsError || organizations.error) && (
        <Text accessibilityRole="alert" style={{ color: theme.destructive }}>
          {error || optionsError || organizations.error}
        </Text>
      )}
      {session && renewal && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.foreground }}>
            Your sign-in needs renewing before you can do that.
          </Text>
          <Button
            disabled={busy}
            title="Sign in again"
            onPress={() => {
              void act(async () => {
                await renewHostedSignIn(renewal);
                setRenewal(null);
                await refreshOrganizations();
              });
            }}
          />
        </View>
      )}
      {view === "held-out" ? (
        <>
          <Text style={{ color: theme.foreground }}>{HELD_OUT}</Text>
          {linkButtons(companySignIn.data?.providers ?? []).map((link) => (
            <Button
              key={link.providerId}
              disabled={busy}
              title={link.title}
              onPress={() => {
                void act(async () => {
                  /*
                   * A single-use ticket, asked for on this tap and opened at once in the system browser, which signs in
                   * through the company's provider as this person. Back here, the company sign-in is read again: `met`
                   * says whether it took. A provider that no longer counts reads the list again instead.
                   */
                  await linkCompanyAccount(link.providerId, {
                    ticket: companySignInTicket,
                    open: openInSystemBrowser,
                  });
                  await refreshOrganizations();
                  await companySignIn.refresh();
                });
              }}
            />
          ))}
          {signOutButton}
        </>
      ) : view === "in-no-organization" ? (
        <>
          <Button
            disabled={busy || organizations.pending}
            title="Try again"
            onPress={() => {
              void organizations.refresh();
            }}
          />
          {signOutButton}
        </>
      ) : !session ? (
        <View style={{ gap: 12 }}>
          {signInConfigured && (
            <Text style={{ color: theme.foreground }}>
              {isPending
                ? "Checking your session…"
                : "Continue with your organization account."}
            </Text>
          )}
          {options.data?.authProviders?.map((provider) => (
            <Button
              key={provider}
              disabled={busy}
              title={`Sign in with ${provider}`}
              onPress={() => {
                void act(async () => {
                  await signIn(provider);
                  router.replace("/");
                });
              }}
            />
          ))}
          {options.data?.ssoConfigured && (
            <>
              <TextInput
                accessibilityLabel="Work email"
                placeholder="Work email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={theme.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 8,
                  padding: 12,
                  color: theme.foreground,
                }}
              />
              <Button
                disabled={busy || !email}
                title="Continue with organization"
                onPress={() => {
                  void act(() => signInEnterprise(email));
                }}
              />
            </>
          )}
          <Text
            style={{ fontSize: 20, fontWeight: "600", color: theme.foreground }}
          >
            Use an API key
          </Text>
          <ConnectForm />
        </View>
      ) : null}
    </ScrollView>
  );
}
