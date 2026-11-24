/**
 * Keeps a panel's bottom (the composer) above the on-screen keyboard. Android draws apps edge to edge, so the window
 * no longer shrinks for the keyboard: the panel moves its content up itself, by as much as the keyboard covers of it.
 * It measures where it sits in the window, which differs between a full screen (under the header) and the panel beside
 * the conversation list, so the lift is right in both.
 */
import { type ReactNode, useRef, useState } from "react";
import { type HostInstance, KeyboardAvoidingView, View } from "react-native";

export function KeyboardSafe({
  children,
  backgroundColor,
}: {
  children: ReactNode;
  backgroundColor: string;
}) {
  const frame = useRef<HostInstance>(null);
  const [top, setTop] = useState(0);
  return (
    <View
      ref={frame}
      style={{ flex: 1, backgroundColor }}
      onLayout={() =>
        frame.current?.measureInWindow((_x, y) => {
          if (Number.isFinite(y)) setTop(y);
        })
      }
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={top}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
