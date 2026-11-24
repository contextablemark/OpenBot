import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExpoConfig } from "expo/config";

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
/** The OpenBot release this app is built from: the repository's own version, which the app names on every request. */
const openbotRelease = (
  JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
    version: string;
  }
).version;
const config: ExpoConfig = {
  name: "OpenBot",
  slug: "openbot",
  version: "0.0.1",
  scheme: "openbotmobile",
  // Light or dark as the device is, like OpenBot on the computer (src/theme.ts).
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: "ai.openbot.mobile", supportsTablet: true },
  // The OpenBot orb, as OpenBot Desktop's icon (desktop/src-tauri/icons/icon.png). On Android it sits in the adaptive
  // icon's safe zone on the front end's light background; themed icons use its silhouette.
  icon: "./assets/app-icon.png",
  android: {
    package: "ai.openbot.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-foreground.png",
      monochromeImage: "./assets/adaptive-monochrome.png",
      backgroundColor: "#f9f9fb",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // Dictation in the composer, with the device's own speech recognition (src/dictation.ts). Android asks for the
    // microphone the first time it is used; Google's on-device speech service is the one it uses.
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "OpenBot uses the microphone when you dictate a message.",
        speechRecognitionPermission:
          "OpenBot turns what you say into text on this device when you dictate a message.",
        androidSpeechServicePackages: ["com.google.android.as"],
      },
    ],
    ["expo-notifications", { defaultChannel: "openbot" }],
    // Back from linking the company account after the process died mid-sign-in: no Custom Tab left below Home.
    "./plugins/linked-cold-start",
    // Plain http to an OpenBot on the person's own network, used with an API key; src/server-address.ts limits where.
    "./plugins/cleartext-on-your-network",
  ],
  extra: { openbotRelease, ...(projectId ? { eas: { projectId } } : {}) },
};
export default config;
