import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../../../src/auth/auth-session-context";
import { useFamilyStore } from "../../../src/family/FamilyProvider";
import { messageForFamilyValidationCode } from "../../../src/family/family-messages";
import {
  FamilyClientValidationError,
  parseCreateFamilyInput,
} from "../../../src/family/family-validation";
import { shellStyles } from "../../../src/ui/shell-styles";

export default function CreateFamilyScreen() {
  const session = useAuthSession();
  const family = useFamilyStore();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (submitting) {
      return;
    }

    setError(null);

    try {
      parseCreateFamilyInput({ displayName });
    } catch (validationError: unknown) {
      if (validationError instanceof FamilyClientValidationError) {
        setError(messageForFamilyValidationCode(validationError.code));
        return;
      }
      setError(messageForFamilyValidationCode("DISPLAY_NAME_INVALID"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await family.createFamily(displayName);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (
        session.status !== "authenticated" ||
        session.principal === null ||
        !result.family
      ) {
        return;
      }

      router.replace(`/(app)/families/${result.family.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Create Family" }} />
      <KeyboardAvoidingView
        style={shellStyles.scrollContent}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={shellStyles.title} accessibilityRole="header">
          Create Family
        </Text>
        <Text style={shellStyles.subtitle}>Choose a name for this Family.</Text>

        <Text style={shellStyles.label} nativeID="family-display-name-label">
          Family name
        </Text>
        <TextInput
          style={shellStyles.input}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect
          textContentType="nickname"
          accessibilityLabel="Family name"
          accessibilityLabelledBy="family-display-name-label"
          accessibilityHint="Required. Maximum 100 characters."
          editable={!submitting}
        />

        {error ? (
          <Text
            style={shellStyles.errorText}
            accessibilityLiveRegion="polite"
            accessibilityLabel={error}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Family"
          accessibilityState={{ disabled: submitting, busy: submitting }}
          style={[
            shellStyles.primaryButton,
            submitting ? shellStyles.primaryButtonDisabled : null,
          ]}
          disabled={submitting}
          onPress={() => {
            void onSubmit();
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={shellStyles.primaryButtonText}>Create Family</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel create Family"
          style={shellStyles.secondaryButton}
          disabled={submitting}
          onPress={() => {
            router.back();
          }}
        >
          <Text style={shellStyles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
