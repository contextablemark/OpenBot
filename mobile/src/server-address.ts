/**
 * Which OpenBot address a person may type on the phone for key access (../key-access.ts), and the origin it is used at.
 *
 * An API key is a password for the person's whole account, so it never crosses the internet in the clear: `https:` is
 * needed everywhere except at an IP address that cannot be reached from the internet. Those are a private network's
 * (10/8, 172.16/12, 192.168/16), the phone's own (127/8, ::1), and the shared range 100.64/10 that Tailscale and other
 * overlay networks hand out. A name is never trusted that way, however it is spelled (a `.ts.net` or `.local` name
 * could resolve anywhere), so a name always needs `https:`. Android lets the app speak plain http at all (the
 * cleartext plugin); this module is what holds it to these addresses. It imports nothing, so it can be tested without a
 * phone.
 */

/** The dotted-quad form of an IPv4 address, as its four numbers, or undefined for anything else. */
function ipv4(host: string): [number, number, number, number] | undefined {
  const parts = host.split(".");
  if (parts.length !== 4) return undefined;
  const numbers = parts.map((part) =>
    /^(0|[1-9]\d{0,2})$/.test(part) ? Number(part) : Number.NaN,
  );
  if (numbers.some((value) => !(value >= 0 && value <= 255))) return undefined;
  return numbers as [number, number, number, number];
}

/** Whether plain http may be used to reach `hostname` (as `URL.hostname` gives it: IPv6 in brackets). */
export function plainHttpAllowed(hostname: string): boolean {
  if (hostname === "[::1]") return true;
  const address = ipv4(hostname);
  if (!address) return false;
  const [a, b] = address;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    // 100.64.0.0/10: 100.64.0.0 to 100.127.255.255.
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** What a person is told when the address they typed can't be used. */
export const ADDRESS_NOT_VALID =
  "Enter your OpenBot's address, like http://192.168.1.20:3001.";
export const ADDRESS_NEEDS_HTTPS =
  "This address needs https. Plain http works only for an IP address on your own network.";

/**
 * The origin to use for what a person typed as their OpenBot's address: a scheme is optional and http is assumed, a
 * trailing slash or path is dropped. Throws a sentence for the person when it can't be used.
 */
export function serverOrigin(typed: string): string {
  const trimmed = typed.trim();
  if (!trimmed) throw new Error(ADDRESS_NOT_VALID);
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(ADDRESS_NOT_VALID);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(ADDRESS_NOT_VALID);
  if (url.username || url.password || url.search || url.hash || !url.hostname)
    throw new Error(ADDRESS_NOT_VALID);
  if (url.protocol === "http:" && !plainHttpAllowed(url.hostname))
    throw new Error(ADDRESS_NEEDS_HTTPS);
  return url.origin;
}
