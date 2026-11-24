/**
 * Using OpenBot with an API key instead of signing in: OpenBot Cloud (https://api.open.bot), or an OpenBot with no
 * sign-in of its own, like the one OpenBot Desktop runs, reached over the local network or Tailscale.
 *
 * The phone keeps every connection the person adds (an address, a key, and the organization the key works in) and
 * opens in the one used last. Settings lists them to switch between, add another, or remove one. Each is checked
 * when added (./key-check.ts), and every request goes to the current one with `Authorization: Bearer <key>` in its
 * organization (./api/request.ts). While one is current the app counts as signed in (./signed-in.ts).
 *
 * Kept in SecureStore. A phone that kept one connection under the older single-connection layout carries it over.
 */
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

export type KeyAccess = {
  /** The OpenBot's origin, checked by ./server-address.ts. */
  server: string;
  /** The API key, `obk_…`. */
  key: string;
  /** The organization the key works in. */
  organization: string;
  organizationName?: string;
  /** What the person calls this connection, when they named it ("Home Desktop"). */
  name?: string;
};

/** A kept connection: which one it is, and when it was last used. */
export type Connection = KeyAccess & { id: string; lastUsed: number };

type Kept = { current: string | null; connections: Connection[] };

/** Where the connections are kept. */
const STORE = "openbot-key-connections";
/** Where the older single-connection layout kept its one. */
const OLD_STORE = "openbot-key-access";

/** The same OpenBot and organization is the same connection: adding it again replaces its key. */
export function connectionId(access: KeyAccess): string {
  return `${access.server}|${access.organization}`;
}

/** What a connection is called: the name the person gave it, else its organization and where it is. */
export function connectionLabel(access: KeyAccess): string {
  if (access.name?.trim()) return access.name.trim();
  let host = access.server;
  try {
    host = new URL(access.server).host;
  } catch {}
  const name =
    access.organizationName ??
    (access.organization === "default" ? undefined : access.organization);
  return name ? `${name} · ${host}` : host;
}

function parseAccess(value: Partial<KeyAccess> | null | undefined) {
  if (
    value &&
    typeof value.server === "string" &&
    typeof value.key === "string" &&
    typeof value.organization === "string"
  )
    return {
      server: value.server,
      key: value.key,
      organization: value.organization,
      ...(typeof value.organizationName === "string"
        ? { organizationName: value.organizationName }
        : {}),
      ...(typeof value.name === "string" && value.name.trim()
        ? { name: value.name.trim() }
        : {}),
    };
  return null;
}

function parseKept(text: string | null): Kept | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Kept>;
    const connections = (
      Array.isArray(value.connections) ? value.connections : []
    ).flatMap((one) => {
      const access = parseAccess(one);
      if (!access) return [];
      return [
        {
          ...access,
          id: connectionId(access),
          lastUsed: typeof one.lastUsed === "number" ? one.lastUsed : 0,
        },
      ];
    });
    const current =
      typeof value.current === "string" &&
      connections.some((one) => one.id === value.current)
        ? value.current
        : null;
    return { current, connections };
  } catch {
    return null;
  }
}

/** When a connection was used: always after the last, so the order holds even within one millisecond. */
let lastStamp = 0;
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

let kept: Kept = { current: null, connections: [] };
let loaded = false;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of [...listeners]) listener();
}

async function persist(next: Kept): Promise<void> {
  await SecureStore.setItemAsync(STORE, JSON.stringify(next));
  kept = next;
  announce();
}

/** Read what this phone keeps, once. Every request waits for it, so none goes out before it is known. */
const reading: Promise<void> = (async () => {
  try {
    const found = parseKept(await SecureStore.getItemAsync(STORE));
    if (found) {
      kept = found;
      return;
    }
    // The older layout kept one connection: carry it over as the current one.
    const old = await SecureStore.getItemAsync(OLD_STORE);
    let single: KeyAccess | null = null;
    try {
      single = parseAccess(old ? JSON.parse(old) : null);
    } catch {}
    if (single) {
      const connection = {
        ...single,
        id: connectionId(single),
        lastUsed: stamp(),
      };
      kept = { current: connection.id, connections: [connection] };
      await SecureStore.setItemAsync(STORE, JSON.stringify(kept));
      await SecureStore.deleteItemAsync(OLD_STORE);
    }
  } catch {
    kept = { current: null, connections: [] };
  }
})().finally(() => {
  loaded = true;
  announce();
});

function currentOf(state: Kept): Connection | null {
  return state.connections.find((one) => one.id === state.current) ?? null;
}

/** The connection in use, once what the phone keeps has been read. */
export async function keyAccess(): Promise<KeyAccess | null> {
  await reading;
  return currentOf(kept);
}

/** The connection in use right now, without waiting: null until it has been read. */
export function keyAccessNow(): KeyAccess | null {
  return currentOf(kept);
}

/** Every kept connection, most recently used first. */
export function connectionsNow(): Connection[] {
  return [...kept.connections].sort((a, b) => b.lastUsed - a.lastUsed);
}

/** The connection in use, every kept connection, and whether the phone has finished reading them. */
export function useKeyAccess(): {
  access: Connection | null;
  connections: Connection[];
  loaded: boolean;
} {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { access: currentOf(kept), connections: connectionsNow(), loaded };
}

/** Keep this connection (replacing the key of the same one) and use it from now on. */
export async function saveKeyAccess(access: KeyAccess): Promise<void> {
  await reading;
  const id = connectionId(access);
  // Adding the same one again keeps the name it was given, unless a new one comes with it.
  const name =
    access.name?.trim() || kept.connections.find((one) => one.id === id)?.name;
  const connection: Connection = {
    ...access,
    ...(name ? { name } : {}),
    id,
    lastUsed: stamp(),
  };
  await persist({
    current: id,
    connections: [
      connection,
      ...kept.connections.filter((one) => one.id !== id),
    ],
  });
}

/** Name a kept connection, or, with an empty name, go back to calling it by its organization and address. */
export async function renameConnection(
  id: string,
  name: string,
): Promise<void> {
  await reading;
  const trimmed = name.trim();
  await persist({
    current: kept.current,
    connections: kept.connections.map((one) => {
      if (one.id !== id) return one;
      const { name: _old, ...rest } = one;
      return trimmed ? { ...rest, name: trimmed } : rest;
    }),
  });
}

/** Use another kept connection from now on. */
export async function switchConnection(id: string): Promise<void> {
  await reading;
  if (!kept.connections.some((one) => one.id === id)) return;
  await persist({
    current: id,
    connections: kept.connections.map((one) =>
      one.id === id ? { ...one, lastUsed: stamp() } : one,
    ),
  });
}

/**
 * Forget a kept connection. Forgetting the one in use moves to the one used most recently of the rest, or, with none
 * left, back to the screen that connects.
 */
export async function removeConnection(id: string): Promise<void> {
  await reading;
  const connections = kept.connections.filter((one) => one.id !== id);
  const next =
    kept.current === id
      ? ([...connections].sort((a, b) => b.lastUsed - a.lastUsed)[0]?.id ??
        null)
      : kept.current;
  await persist({ current: next, connections });
}

/** Forget the connection in use (Disconnect). */
export async function forgetKeyAccess(): Promise<void> {
  await reading;
  if (kept.current) await removeConnection(kept.current);
}
