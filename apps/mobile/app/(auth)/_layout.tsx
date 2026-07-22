import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuthSession } from "../../src/auth/auth-session-context";
import { resolveShellRedirect } from "../../src/auth/session-shell-state";
import { shellStyles } from "../../src/ui/shell-styles";

export default function AuthLayout() {
  const session = useAuthSession();
  const redirect = resolveShellRedirect({
    status: session.status,
    group: "auth",
  });

  if (session.status === "bootstrapping") {
    return (
      <View style={shellStyles.centered} accessibilityLabel="Loading">
        <ActivityIndicator />
        <Text style={[shellStyles.bodyText, { marginTop: 16 }]}>Loading…</Text>
      </View>
    );
  }

  if (redirect.kind === "replace") {
    return <Redirect href={redirect.href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        title: "Lumora",
      }}
    />
  );
}
