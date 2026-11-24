/**
 * Who is using the app and how they set OpenBot up: the person (their name for the sidebar's footer, and the OpenBot
 * release the server runs, which the apps show beside it) and their preferences, which are the same on every device
 * they use. Read once per sign-in and shared by every screen; a change made in Settings reaches them all at once.
 */
import { useEffect, useState } from "react";
import { ME, ORGANIZATION_ID } from "./api";
import type {
  GetPersonResponse,
  Preferences,
  UpdatePreferencesRequest,
} from "./api/generated/model";
import {
  getPerson,
  getPreferences,
  updatePreferences,
} from "./api/generated/people/people";

type State = {
  me?: GetPersonResponse;
  preferences?: Preferences;
  error?: string;
};

let state: State = {};
let reading: Promise<void> | null = null;
let readFor: string | undefined;
const listeners = new Set<() => void>();
function set(next: State) {
  state = next;
  for (const listener of [...listeners]) listener();
}

function read(who: string): Promise<void> {
  if (reading && readFor === who) return reading;
  readFor = who;
  state = {};
  reading = Promise.all([
    getPerson(ORGANIZATION_ID, ME),
    getPreferences(ORGANIZATION_ID, ME),
  ])
    .then(([me, preferences]) => {
      if (readFor === who) set({ me, preferences });
    })
    .catch((failure: unknown) => {
      reading = null;
      if (readFor === who)
        set({
          error:
            failure instanceof Error
              ? failure.message
              : "Couldn't load your account.",
        });
    });
  return reading;
}

/** The person and their preferences, for whoever `who` names (the signed-in session or key); nothing while signed out. */
export function useAccount(who: string | undefined): State {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    if (who) void read(who);
    return () => {
      listeners.delete(listener);
    };
  }, [who]);
  return who && readFor === who ? state : {};
}

/** Change preferences on OpenBot; every screen shows the answer. */
export async function savePreferences(
  change: UpdatePreferencesRequest,
): Promise<void> {
  const preferences = await updatePreferences(ORGANIZATION_ID, ME, change);
  set({ ...state, preferences });
}

/** A release as people read it: "v1.1.2", whether or not OpenBot already wrote the "v". */
export function versionLabel(version: string | null | undefined): string {
  const bare = version?.trim().replace(/^v/i, "");
  return bare ? `v${bare}` : "";
}

/** One letter for someone's avatar: the first of their name, else of their email. */
export function initialOf(name: string | null | undefined, email?: string) {
  const source = (name?.trim() || email?.trim() || "?").replace(/^\W+/, "");
  return (source[0] ?? "?").toUpperCase();
}
