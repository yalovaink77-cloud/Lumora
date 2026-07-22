import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthSessionProvider } from "../src/auth/auth-session-context";
import { ChildProvider } from "../src/child/ChildProvider";
import { FamilyProvider } from "../src/family/FamilyProvider";
import { PregnancyProvider } from "../src/pregnancy/PregnancyProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthSessionProvider>
          <FamilyProvider>
            <PregnancyProvider>
              <ChildProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }} />
              </ChildProvider>
            </PregnancyProvider>
          </FamilyProvider>
        </AuthSessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
