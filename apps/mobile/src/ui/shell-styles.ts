import { StyleSheet } from "react-native";

/** Minimal functional styles for the authenticated shell (no design system). */
export const shellStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    color: "#111111",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444444",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#222222",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  primaryButton: {
    backgroundColor: "#111111",
    borderRadius: 8,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  errorText: {
    color: "#8b1a1a",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333333",
    marginBottom: 12,
  },
  disclosureText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#111111",
    marginBottom: 16,
  },
  contentId: {
    fontSize: 12,
    lineHeight: 16,
    color: "#666666",
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
});
