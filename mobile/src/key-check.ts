/**
 * Check an OpenBot address and an API key a person typed (./key-access.ts), before anything is kept: the key's
 * organizations, read through the generated client with that address and key, or a sentence for the person saying
 * what is wrong.
 */

import { listOrganizations } from "./api/generated/organizations/organizations";
import { ApiError, DEPLOYMENT_ORGANIZATION_ID } from "./api/request";
import { serverOrigin } from "./server-address";

export type KeyOrganization = { id: string; name?: string };

/** What a key starts with. */
const KEY_PREFIX = "obk_";

export async function checkKey(
  typedAddress: string,
  typedKey: string,
): Promise<{ server: string; key: string; organizations: KeyOrganization[] }> {
  const server = serverOrigin(typedAddress);
  const key = typedKey.trim();
  if (!key.startsWith(KEY_PREFIX))
    throw new Error(
      "That isn't an OpenBot API key. Keys start with obk_. Make one in OpenBot under Settings, then API keys.",
    );
  try {
    const page = await listOrganizations(
      { limit: 100 },
      { withKey: { server, key } },
    );
    const organizations = page.organizations.map((one) => ({
      id: one.id,
      ...(one.name ? { name: one.name } : {}),
    }));
    if (organizations.length === 0)
      throw new Error(
        "This key's account isn't in an organization here. Ask an admin to add you.",
      );
    return { server, key, organizations };
  } catch (error) {
    if (error instanceof ApiError) {
      // An OpenBot that keeps one organization may have no list of them.
      if (error.status === 404)
        return {
          server,
          key,
          organizations: [{ id: DEPLOYMENT_ORGANIZATION_ID }],
        };
      if (error.status === 401)
        throw new Error(
          "OpenBot didn't accept this key. Check it, or make a new one under Settings, then API keys.",
        );
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("This key's"))
      throw error;
    throw new Error(
      `Couldn't reach OpenBot at ${server}. Check the address, and that this phone is on the same network.`,
    );
  }
}
