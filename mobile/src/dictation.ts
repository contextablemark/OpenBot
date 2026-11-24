/**
 * Dictation into the composer with the device's own speech recognition. Two recognizers, in order:
 * - Android's on-device recognizer (SpeechRecognizer.createOnDeviceSpeechRecognizer), where it works: never the
 *   network.
 * - Google's Speech Services (com.google.android.tts) with "prefer offline", where the on-device one can't be reached
 *   (Android XR reports it but can't bind to it). It recognises on the device with the language's offline pack.
 * The first that starts is remembered for the rest of the session.
 *
 * It listens continuously, adding words as they are recognised after whatever was already typed, and stops by itself
 * after a stretch of silence. Nothing is sent: the person reads it, fixes it, and sends it themselves.
 */

import * as Device from "expo-device";
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

/** Google's Speech Services, the recognizer Android XR uses. */
const SPEECH_SERVICES = "com.google.android.tts";
/** Stop after this long without a word, once something was said. */
export const SILENCE_MS = 5_000;
/** Stop after this long if nothing at all was said. */
export const NOTHING_SAID_MS = 3_000;
/** How long a stopped recognizer may take to end before it is aborted. */
const RELEASE_WAIT_MS = 1_500;
/** A second press this soon after the first is the same press (a key can deliver one twice). */
const PRESS_GAP_MS = 500;
/** A recognizer that hasn't started by then isn't going to: try the next one. */
const START_WAIT_MS = 2_500;

type Engine = "on-device" | "speech-services";

/** The device's language, as the recognizer names one ("en-US"). */
function deviceLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

/** Which recognizers this device has, in the order to try them. Read once. */
let engines: Engine[] | undefined;
function availableEngines(): Engine[] {
  if (engines) return engines;
  engines = [];
  if (Platform.OS !== "android") return engines;
  try {
    if (ExpoSpeechRecognitionModule.supportsOnDeviceRecognition())
      engines.push("on-device");
  } catch {}
  try {
    if (
      ExpoSpeechRecognitionModule.getSpeechRecognitionServices().includes(
        SPEECH_SERVICES,
      )
    )
      engines.push("speech-services");
  } catch {}
  return engines;
}
/** The recognizer that worked last; tried first next time. */
let working: Engine | undefined;

/**
 * The order to try them on this device. Android XR lists the on-device recognizer but can't reach it, so there Speech
 * Services goes first, with no wait on the one that won't start.
 */
async function preferredEngines(): Promise<Engine[]> {
  const order = availableEngines();
  const xr = await Device.hasPlatformFeatureAsync(
    "android.software.xr.api.spatial",
  ).catch(() => false);
  return xr
    ? [
        ...order.filter((one) => one === "speech-services"),
        ...order.filter((one) => one !== "speech-services"),
      ]
    : order;
}

export function dictationAvailable(): boolean {
  return availableEngines().length > 0;
}

function optionsFor(
  engine: Engine,
  lang: string,
): ExpoSpeechRecognitionOptions {
  const common = {
    lang,
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
  };
  return engine === "on-device"
    ? { ...common, requiresOnDeviceRecognition: true }
    : {
        ...common,
        androidRecognitionServicePackage: SPEECH_SERVICES,
        androidIntentOptions: { EXTRA_PREFER_OFFLINE: true },
      };
}

/** What the person is told when dictation can't go on. Nothing for silence: they just didn't say anything. */
export function sentenceFor(code: string): string | null {
  switch (code) {
    case "no-speech":
    case "speech-timeout":
    case "aborted":
      return null;
    case "not-allowed":
      return "OpenBot can't use the microphone. Allow it in your device's settings, then try again.";
    case "language-not-supported":
      return "Your device needs its offline speech for your language first. Download it when your device asks, then try again.";
    case "audio-capture":
      return "Couldn't hear the microphone. Check that no other app is using it, then try again.";
    default:
      return "Dictation stopped. Try again.";
  }
}

/** Joins recognised words onto what was already there, with one space between. */
export function joinDictation(before: string, said: string): string {
  const spoken = said.trim();
  if (!spoken) return before;
  if (!before.trim()) return spoken;
  return /\s$/.test(before) ? `${before}${spoken}` : `${before} ${spoken}`;
}

export function useDictation({
  value,
  onChange,
}: {
  /** The composer's text now: dictation adds to it. */
  value: string;
  onChange: (text: string) => void;
}) {
  /** "starting" from the press until the recognizer answers, so the button changes at once. */
  const [state, setStateValue] = useState<"idle" | "starting" | "listening">(
    "idle",
  );
  // The same, for the recognizer's events, which mustn't read a stale render's value.
  const phase = useRef<"idle" | "starting" | "listening">("idle");
  const setState = useCallback((next: "idle" | "starting" | "listening") => {
    phase.current = next;
    setStateValue(next);
  }, []);
  /** How loud the person is, 0 to 1, for the button's ring. */
  const [level, setLevel] = useState(0);
  const [problem, setProblem] = useState("");
  /** The text before this dictation started, plus each finished phrase since. */
  const kept = useRef("");
  const language = useRef(deviceLanguage());
  const engine = useRef<Engine | undefined>(undefined);
  const heardSomething = useRef(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const active = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastPress = useRef(0);
  const lastHeard = useRef("");

  const clearTimers = useCallback(() => {
    clearTimeout(startTimer.current);
    clearTimeout(silenceTimer.current);
    clearTimeout(releaseTimer.current);
  }, []);

  const finish = useCallback(() => {
    active.current = false;
    clearTimers();
    // Whatever ended it, the microphone is let go: abort is harmless on a recognizer that already ended, and the only
    // way to free one that never started.
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
    setState("idle");
    setLevel(0);
  }, [clearTimers, setState]);

  const stop = useCallback(() => {
    if (!active.current) return;
    if (phase.current === "starting") {
      // Not started yet: nothing to finish. Abort (in finish) lets the microphone go.
      finish();
      return;
    }
    // Ask it to finish what it heard: the last words still arrive, and its "end" finishes here. The button shows it
    // stopped at once; one that hasn't ended in a moment is aborted, so the microphone is always let go.
    ExpoSpeechRecognitionModule.stop();
    clearTimers();
    setState("idle");
    setLevel(0);
    releaseTimer.current = setTimeout(() => {
      if (active.current) finish();
    }, RELEASE_WAIT_MS);
  }, [finish, clearTimers, setState]);

  /** Stop by itself once the person has gone quiet. */
  const armSilence = useCallback(() => {
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(
      () => stop(),
      heardSomething.current ? SILENCE_MS : NOTHING_SAID_MS,
    );
  }, [stop]);

  const tryEngine = useCallback(
    (candidates: Engine[]) => {
      const [next, ...rest] = candidates;
      if (!next) {
        finish();
        setProblem("Dictation isn't available on this device.");
        return;
      }
      engine.current = next;
      clearTimeout(startTimer.current);
      // A recognizer that never starts (one Android lists but can't reach) gives way to the next.
      startTimer.current = setTimeout(() => {
        ExpoSpeechRecognitionModule.abort();
        if (!active.current) return;
        tryEngine(rest);
      }, START_WAIT_MS);
      try {
        ExpoSpeechRecognitionModule.start(optionsFor(next, language.current));
      } catch {
        tryEngine(rest);
      }
    },
    [finish],
  );

  useSpeechRecognitionEvent("start", () => {
    if (!active.current) return;
    clearTimeout(startTimer.current);
    working = engine.current;
    setState("listening");
    armSilence();
  });
  useSpeechRecognitionEvent("speechstart", () => {
    if (!active.current) return;
    heardSomething.current = true;
    armSilence();
  });
  useSpeechRecognitionEvent("volumechange", (event) => {
    if (!active.current) return;
    // Android gives about -2 (quiet) to 10 (loud).
    setLevel(Math.max(0, Math.min(1, (event.value + 2) / 12)));
  });
  useSpeechRecognitionEvent("result", (event) => {
    if (!active.current) return;
    const said = event.results[0]?.transcript ?? "";
    // Recognizers repeat the same words while nothing new is said: only new words count as speech.
    const changed = said !== lastHeard.current || event.isFinal;
    lastHeard.current = event.isFinal ? "" : said;
    if (said.trim()) heardSomething.current = true;
    if (event.isFinal) {
      kept.current = joinDictation(kept.current, said);
      onChange(kept.current);
    } else onChange(joinDictation(kept.current, said));
    if (changed) armSilence();
  });
  useSpeechRecognitionEvent("end", () => {
    // In continuous listening the recognizer ends only when stopped, or on its own limit: either way, done.
    if (active.current && phase.current !== "starting") finish();
  });
  useSpeechRecognitionEvent("error", (event) => {
    if (!active.current) return;
    // The recognizer just given up on, ending: not about the one now starting.
    if (event.error === "aborted" && phase.current === "starting") return;
    // Before it started, an error means this recognizer can't be used here: try the next.
    if (phase.current === "starting" && event.error !== "not-allowed") {
      const order = availableEngines();
      const rest = order.slice(order.indexOf(engine.current ?? order[0]) + 1);
      if (event.error === "language-not-supported")
        void ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
          locale: language.current,
        }).catch(() => undefined);
      if (rest.length) {
        tryEngine(rest);
        return;
      }
    }
    finish();
    const sentence = sentenceFor(event.error);
    if (sentence) setProblem(sentence);
  });

  /*
   * Never leave the microphone on: leaving the conversation, or the app going to the background, ends dictation. A
   * recording left open blocks every other app's voice input, the keyboard's included.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      // Only the background: a system dialog (the microphone permission) makes the app "inactive" for a moment.
      if (next === "background" && active.current) {
        ExpoSpeechRecognitionModule.abort();
        finish();
      }
    });
    return () => {
      subscription.remove();
      clearTimers();
      if (active.current) {
        active.current = false;
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, [clearTimers, finish]);

  const start = useCallback(async () => {
    setProblem("");
    active.current = true;
    heardSomething.current = false;
    lastHeard.current = "";
    setState("starting");
    // Checked first, and asked only when not yet given: asking, even for a permission already granted, briefly shows
    // Android's (invisible) permission screen.
    const current =
      await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync();
    const permission = current.granted
      ? current
      : await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    // Stopped while the permission was asked: nothing to start.
    if (!active.current) return;
    if (!permission.granted) {
      finish();
      setProblem(
        "OpenBot can't use the microphone. Allow it in your device's settings, then try again.",
      );
      return;
    }
    kept.current = value;
    const order = await preferredEngines();
    tryEngine(
      working ? [working, ...order.filter((one) => one !== working)] : order,
    );
  }, [value, finish, tryEngine, setState]);

  return {
    available: dictationAvailable(),
    listening: state !== "idle",
    level,
    problem,
    toggle: () => {
      const now = Date.now();
      if (now - lastPress.current < PRESS_GAP_MS) return;
      lastPress.current = now;
      if (active.current) stop();
      else void start();
    },
    stop,
    /**
     * End dictation now and drop whatever the recognizer still sends: the message is being sent as it stands, and a
     * phrase finished a moment later must not write itself back into the emptied box. Also covers the moment after
     * a stop, while the recognizer is still finishing.
     */
    cancel: () => {
      if (active.current) finish();
    },
  };
}
