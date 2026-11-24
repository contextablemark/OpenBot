import { expect, mock, test } from "bun:test";

// The recognizer is the device's; only how its words join the composer's text is the app's own.
mock.module("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {},
  useSpeechRecognitionEvent: () => {},
}));
mock.module("expo-device", () => ({
  hasPlatformFeatureAsync: async () => false,
}));
mock.module("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Platform: { OS: "android" },
}));
const { joinDictation } = await import("../src/dictation");

test("dictated words follow what was typed, with one space", () => {
  expect(joinDictation("", "hello there")).toBe("hello there");
  expect(joinDictation("Hi", "how are you")).toBe("Hi how are you");
  expect(joinDictation("Hi ", "how are you")).toBe("Hi how are you");
  expect(joinDictation("Hi", "   ")).toBe("Hi");
});
