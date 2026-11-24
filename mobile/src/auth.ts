import { expoClient } from "@better-auth/expo/client";
import { ssoClient } from "@better-auth/sso/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { openWith } from "./link-company";
import type { OrganizationStore } from "./organization";
import { clientHeaders } from "./release";

/*
 * The OpenBot people sign in to, fixed when the app is built. Optional: a build without one offers only an API key
 * (./key-access.ts), for an OpenBot with no sign-in of its own, typed in on the phone.
 */
const configured = process.env.EXPO_PUBLIC_SERVER_URL;
/** Where nothing was configured: never dialled, since sign-in's requests are answered on the phone (below). */
const NOWHERE = "https://openbot.invalid";
const endpoint = new URL(configured || NOWHERE);
if (
  configured &&
  endpoint.protocol !== "https:" &&
  !(__DEV__ && endpoint.protocol === "http:")
)
  throw new Error("OpenBot native sign-in requires HTTPS.");
if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
  throw new Error(
    "Use the public deployment URL without credentials or query parameters.",
  );
/** Whether this build has an OpenBot to sign in to. Without one, only an API key can be used. */
export const signInConfigured = Boolean(configured);
/** The OpenBot this build signs in to, or "" when it has none. */
export const serverUrl = configured ? endpoint.origin : "";
/** A build with nowhere to sign in: every request of the sign-in client is answered "nobody is signed in". */
const signedOutFetch = async (_input: unknown, _init?: unknown) =>
  new Response("null", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
export const authClient = createAuthClient({
  baseURL: endpoint.origin,
  // Sign-in's own requests name the app too; the Expo plugin keeps these and adds the session's cookie.
  fetchOptions: {
    headers: clientHeaders(),
    ...(configured ? {} : { customFetchImpl: signedOutFetch }),
  },
  plugins: [
    expoClient({
      scheme: "openbotmobile",
      storagePrefix: `openbot-${endpoint.host.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      storage: SecureStore,
    }),
    ssoClient(),
  ],
});
export async function signIn(provider: "google" | "microsoft" | "okta") {
  const result = await authClient.signIn.social({
    provider: provider as "google",
    callbackURL: "openbotmobile://",
  });
  if (result.error)
    throw new Error(result.error.message ?? "Could not sign in.");
}
export async function signInEnterprise(email: string) {
  const result = await authClient.signIn.sso({
    email,
    callbackURL: "openbotmobile://",
  });
  if (result.error)
    throw new Error(
      result.error.message ?? "Could not sign in to your organization.",
    );
}

/**
 * Open an address in the system browser's sign-in session (ASWebAuthenticationSession on iOS, Custom Tabs on Android),
 * never a web view: a company's sign-in is entered where the person can see whose page it is. Resolves when it comes
 * back to `returnTo` or is closed. Linking the company account opens its single-use ticket here (../link-company.ts).
 */
// In the app's own task on Android, so the tab goes when the app comes back (BROWSER_OPTIONS says why).
export const openInSystemBrowser = openWith(WebBrowser.openAuthSessionAsync);

/**
 * Where each person's pick of organization is kept on this phone (../organization.ts): beside the session, one place
 * for each OpenBot and each person on it, so a phone people share opens in each one's own pick.
 */
const pickedOrganization = (person: string) =>
  `openbot-${endpoint.host}-organization-${person}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "-",
  );
export const organizationStore: OrganizationStore = {
  read: (person) => SecureStore.getItemAsync(pickedOrganization(person)),
  write: (person, id) =>
    SecureStore.setItemAsync(pickedOrganization(person), id),
};

/**
 * Renew a hosted OpenBot's sign-in: its hosted sign-in (`signIn`, a path on this OpenBot) opened in the in-app browser,
 * as sign-in itself is. Somebody still signed in to OpenBot by CopilotKit goes through it with nothing to type; it
 * resolves when the browser comes back or is closed, and the request is then sent again.
 */
export async function renewHostedSignIn(signIn: string): Promise<void> {
  const address = new URL(signIn, serverUrl);
  address.searchParams.set("returnTo", "openbotmobile://renewed");
  await WebBrowser.openAuthSessionAsync(address.href, "openbotmobile://");
}
