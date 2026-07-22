import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../src/auth/auth-session-context";
import { resolveShellRedirect } from "../src/auth/session-shell-state";
import { SafetyDisclosureBody } from "../src/safety/SafetyDisclosureBody";
import { shellStyles } from "../src/ui/shell-styles";

/**
 * First authenticated-entry disclosure gate (ADR-019).
 * Informational continue action only; no acknowledgment persistence.
 */
export default function DisclosureScreen() {
  const session = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = resolveShellRedirect({
    status: session.status,
    group: "entry",
  });

  if (session.status === "bootstrapping") {
    return (
      <View style={shellStyles.centered} accessibilityLabel="Loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (redirect.kind === "replace") {
    return <Redirect href={redirect.href} />;
  }

  async function onSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      const result = await session.signOut();
      if (!result.ok) {
        setError(result.message);
      }
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={shellStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Safety and Limitations disclosure"
      >
        <SafetyDisclosureBody />

        {error ? (
          <Text style={shellStyles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to Home"
          style={shellStyles.primaryButton}
          onPress={session.continueDisclosure}
        >
          <Text style={shellStyles.primaryButtonText}>Continue</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ disabled: signingOut, busy: signingOut }}
          style={[
            shellStyles.secondaryButton,
            signingOut ? shellStyles.primaryButtonDisabled : null,
          ]}
          disabled={signingOut}
          onPress={() => {
            void onSignOut();
          }}
        >
          {signingOut ? (
            <ActivityIndicator />
          ) : (
            <Text style={shellStyles.secondaryButtonText}>Sign out</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
