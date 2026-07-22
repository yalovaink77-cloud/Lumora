import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuthSession } from "../../src/auth/auth-session-context";
import { shellStyles } from "../../src/ui/shell-styles";

export default function HomeScreen() {
  const session = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const principal = session.principal;
  const displayName = principal?.name?.trim() || "Signed-in user";
  const displayEmail = principal?.email ?? "";

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
    <View style={shellStyles.screen}>
      <Text style={shellStyles.title} accessibilityRole="header">
        Home
      </Text>
      <Text style={shellStyles.subtitle}>You are signed in to Lumora.</Text>

      <Text
        style={shellStyles.bodyText}
        accessibilityLabel={`Signed in as ${displayName}`}
      >
        Signed in as {displayName}
      </Text>
      {displayEmail ? (
        <Text
          style={shellStyles.bodyText}
          accessibilityLabel={`Account email ${displayEmail}`}
        >
          {displayEmail}
        </Text>
      ) : null}

      <Text style={shellStyles.bodyText}>
        Pregnancy, Child, and Timeline features are not part of this shell.
      </Text>

      {error ? (
        <Text style={shellStyles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Link href="/(app)/families" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open Families"
          style={shellStyles.primaryButton}
        >
          <Text style={shellStyles.primaryButtonText}>Families</Text>
        </Pressable>
      </Link>

      <Link href="/(app)/safety" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open Safety and Limitations"
          style={shellStyles.secondaryButton}
        >
          <Text style={shellStyles.secondaryButtonText}>
            Safety & Limitations
          </Text>
        </Pressable>
      </Link>

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
    </View>
  );
}
