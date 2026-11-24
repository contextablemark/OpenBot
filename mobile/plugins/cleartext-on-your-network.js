/**
 * Lets the Android app speak plain http, for an OpenBot on the person's own network: the one OpenBot Desktop runs,
 * reached at a private or Tailscale address with an API key (src/key-access.ts).
 *
 * Android refuses cleartext traffic by default, and its network security config can't name a range of IP addresses,
 * so this turns cleartext on for the app as a whole. The app itself holds it to private, loopback and 100.64/10
 * addresses (src/server-address.ts), and every name, and every other address, still needs https. Sign-in to an OpenBot
 * built into the app still needs https too (src/auth.ts).
 *
 * Loads nothing at the top, as ./linked-cold-start.js: only `expo prebuild` runs it, with the phone's dependencies.
 */
function withCleartextOnYourNetwork(config) {
  const { withAndroidManifest } = require("expo/config-plugins");
  return withAndroidManifest(config, (manifest) => {
    const application = manifest.modResults.manifest.application?.[0];
    if (!application)
      throw new Error(
        "openbot-cleartext-on-your-network found no <application> in the manifest.",
      );
    application.$["android:usesCleartextTraffic"] = "true";
    return manifest;
  });
}

module.exports = withCleartextOnYourNetwork;
