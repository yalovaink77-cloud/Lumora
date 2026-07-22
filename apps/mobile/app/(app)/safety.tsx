import { Stack } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SafetyDisclosureBody } from "../../src/safety/SafetyDisclosureBody";
import { shellStyles } from "../../src/ui/shell-styles";

/**
 * Permanently reachable Safety & Limitations surface (ADR-019).
 * Does not modify disclosure continuation state or record viewing.
 */
export default function SafetyLimitationsScreen() {
  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Safety & Limitations" }} />
      <ScrollView
        contentContainerStyle={shellStyles.scrollContent}
        accessibilityLabel="Safety and Limitations"
      >
        <SafetyDisclosureBody showHeading={false} />
      </ScrollView>
    </SafeAreaView>
  );
}
