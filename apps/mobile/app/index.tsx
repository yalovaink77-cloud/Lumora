import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuthSession } from "../src/auth/auth-session-context";
import { resolveShellRedirect } from "../src/auth/session-shell-state";
import { shellStyles } from "../src/ui/shell-styles";

export default function RootIndex() {
  const session = useAuthSession();
  const redirect = resolveShellRedirect({
    status: session.status,
    group: "root",
  });

  if (session.status === "bootstrapping") {
    return (
      <View
        style={shellStyles.centered}
        accessibilityLabel="Restoring session"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator accessibilityLabel="Loading" />
        <Text style={[shellStyles.bodyText, { marginTop: 16 }]}>
          Restoring your session…
        </Text>
      </View>
    );
  }

  if (session.status === "error") {
    return (
      <View style={shellStyles.screen} accessibilityRole="alert">
        <Text style={shellStyles.title}>Unable to continue</Text>
        <Text style={shellStyles.errorText}>
          {session.errorMessage ?? "Something went wrong. Try again."}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry session restore"
          style={shellStyles.primaryButton}
          onPress={session.retryBootstrap}
        >
          <Text style={shellStyles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (redirect.kind === "replace") {
    return <Redirect href={redirect.href} />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
