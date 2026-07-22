import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthSessionProvider } from "../src/auth/auth-session-context";
import { FamilyProvider } from "../src/family/FamilyProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthSessionProvider>
          <FamilyProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </FamilyProvider>
        </AuthSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
