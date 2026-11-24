/**
 * Read something for a screen, and read it again when asked (`refresh`), or every `every` milliseconds while the app
 * is in front. Nothing polls unless it asks to: every read counts against the person's API key, and a key is shared by
 * every device that uses it. Polling holds off while OpenBot has asked the phone to wait (./rate-limit.ts).
 *
 * A read that fails after one has succeeded keeps what is on screen and says nothing: a missed refresh is not worth an
 * error. Only a screen with nothing to show says what went wrong.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { rateLimited } from "./rate-limit";

export function useLoad<T>(
  load: () => Promise<T>,
  enabled = true,
  options: { every?: number } = {},
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const hasData = useRef(false);
  const refresh = useCallback(async () => {
    setPending(true);
    try {
      setData(await load());
      hasData.current = true;
      setError(undefined);
    } catch (failure) {
      if (!hasData.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Couldn't load this. Try again in a moment.",
        );
    } finally {
      setPending(false);
    }
  }, [load]);
  const every = options.every;
  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setError(undefined);
      hasData.current = false;
      return;
    }
    hasData.current = false;
    void refresh();
    if (!every) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && !rateLimited()) void refresh();
    }, every);
    return () => clearInterval(timer);
  }, [enabled, refresh, every]);
  return { data, error, pending, refresh };
}
