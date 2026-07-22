import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

/**
 * Temporary technical bootstrap only.
 * This is not the Sprint 2.9B.2 authenticated user-facing shell.
 * It must not present authentication forms, safety disclosure, Home,
 * Safety & Limitations, or Family-domain product surfaces.
 */
export function App() {
  return (
    <View
      style={styles.container}
      accessibilityLabel="Lumora mobile foundation"
    >
      <Text style={styles.title}>Lumora mobile foundation</Text>
      <Text style={styles.body}>
        Temporary Expo workspace bootstrap. Authenticated shell screens are not
        implemented in Sprint 2.9B.1.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#333333",
  },
});
