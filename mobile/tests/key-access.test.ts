import { expect, mock, test } from "bun:test";

// The phone's secure store, in memory: a connection kept by an older build under the single-connection layout.
const secure = new Map<string, string>([
  [
    "openbot-key-access",
    JSON.stringify({
      server: "https://desktop.example.ts.net",
      key: "obk_desktop",
      organization: "default",
    }),
  ],
]);
mock.module("expo-secure-store", () => ({
  getItemAsync: async (name: string) => secure.get(name) ?? null,
  setItemAsync: async (name: string, value: string) => {
    secure.set(name, value);
  },
  deleteItemAsync: async (name: string) => {
    secure.delete(name);
  },
}));
mock.module("react", () => ({
  useEffect: () => {},
  useState: () => [0, () => {}],
}));

const store = await import("../src/key-access");
const cloud = {
  server: "https://api.open.bot",
  key: "obk_cloud",
  organization: "org_ck",
  organizationName: "CopilotKit",
};

test("a connection kept by an older build carries over as the one in use", async () => {
  expect((await store.keyAccess())?.key).toBe("obk_desktop");
  expect(store.connectionsNow()).toHaveLength(1);
  expect(secure.has("openbot-key-access")).toBe(false);
});

test("adding a connection keeps the others and makes it the one in use", async () => {
  await store.saveKeyAccess(cloud);
  expect((await store.keyAccess())?.server).toBe("https://api.open.bot");
  expect(store.connectionsNow().map((one) => one.key)).toEqual([
    "obk_cloud",
    "obk_desktop",
  ]);
});

test("the same OpenBot and organization again replaces its key, not a second entry", async () => {
  await store.saveKeyAccess({ ...cloud, key: "obk_cloud_2" });
  expect(store.connectionsNow()).toHaveLength(2);
  expect((await store.keyAccess())?.key).toBe("obk_cloud_2");
});

test("switching uses another and remembers it as the last used", async () => {
  const desktop = store
    .connectionsNow()
    .find((one) => one.key === "obk_desktop");
  await store.switchConnection(desktop?.id ?? "");
  expect((await store.keyAccess())?.key).toBe("obk_desktop");
  expect(store.connectionsNow()[0]?.key).toBe("obk_desktop");
  // Kept for the next time the app opens: it opens in this one.
  const kept = JSON.parse(secure.get("openbot-key-connections") ?? "{}");
  expect(kept.current).toBe(desktop?.id);
});

test("removing the one in use moves to the one used most recently, then to none", async () => {
  await store.forgetKeyAccess();
  expect((await store.keyAccess())?.key).toBe("obk_cloud_2");
  await store.forgetKeyAccess();
  expect(await store.keyAccess()).toBeNull();
  expect(store.connectionsNow()).toHaveLength(0);
});

test("a connection is called by its organization and where it is", () => {
  expect(store.connectionLabel(cloud)).toBe("CopilotKit · api.open.bot");
  expect(
    store.connectionLabel({
      server: "https://desktop.example.ts.net",
      key: "k",
      organization: "default",
    }),
  ).toBe("desktop.example.ts.net");
});

test("a connection can be named, keeps its name when added again, and goes back to its label when cleared", async () => {
  await store.saveKeyAccess({ ...cloud, name: "  Work Cloud " });
  const id = store.connectionId(cloud);
  expect(store.connectionLabel(store.connectionsNow()[0] ?? cloud)).toBe(
    "Work Cloud",
  );
  await store.saveKeyAccess({ ...cloud, key: "obk_cloud_3" });
  expect(store.connectionsNow().find((one) => one.id === id)?.name).toBe(
    "Work Cloud",
  );
  await store.renameConnection(id, "Cloud");
  expect(store.connectionsNow().find((one) => one.id === id)?.name).toBe(
    "Cloud",
  );
  await store.renameConnection(id, "   ");
  const cleared = store.connectionsNow().find((one) => one.id === id);
  expect(cleared?.name).toBeUndefined();
  expect(store.connectionLabel(cleared ?? cloud)).toBe(
    "CopilotKit · api.open.bot",
  );
});
