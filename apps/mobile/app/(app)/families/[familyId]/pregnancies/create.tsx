import { Stack, router, useLocalSearchParams } from "expo-router";
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

import { useAuthSession } from "../../../../../src/auth/auth-session-context";
import { usePregnancyStore } from "../../../../../src/pregnancy/PregnancyProvider";
import { messageForPregnancyValidationCode } from "../../../../../src/pregnancy/pregnancy-messages";
import {
  PregnancyClientValidationError,
  parseCreatePregnancyInput,
} from "../../../../../src/pregnancy/pregnancy-validation";
import { shellStyles } from "../../../../../src/ui/shell-styles";

export default function CreatePregnancyScreen() {
  const params = useLocalSearchParams<{ familyId: string | string[] }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const session = useAuthSession();
  const pregnancy = usePregnancyStore();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (submitting || typeof familyId !== "string") {
      return;
    }

    setError(null);

    try {
      parseCreatePregnancyInput({ displayName });
    } catch (validationError: unknown) {
      if (validationError instanceof PregnancyClientValidationError) {
        setError(messageForPregnancyValidationCode(validationError.code));
        return;
      }
      setError(messageForPregnancyValidationCode("DISPLAY_NAME_INVALID"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await pregnancy.createPregnancy(familyId, displayName);
      if (!result.ok) {
        setError(result.message);
        if (result.familyUnavailable) {
          return;
        }
        return;
      }

      if (
        session.status !== "authenticated" ||
        session.principal === null ||
        !result.pregnancy ||
        result.pregnancy.familyId !== familyId
      ) {
        return;
      }

      router.replace(
        `/(app)/families/${familyId}/pregnancies/${result.pregnancy.id}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Create Pregnancy" }} />
      <KeyboardAvoidingView
        style={shellStyles.scrollContent}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={shellStyles.title} accessibilityRole="header">
          Create Pregnancy
        </Text>
        <Text style={shellStyles.subtitle}>
          Choose a name for this organizational Pregnancy record. This is not a
          clinical record.
        </Text>

        <Text style={shellStyles.label} nativeID="pregnancy-display-name-label">
          Pregnancy name
        </Text>
        <TextInput
          style={shellStyles.input}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect
          textContentType="nickname"
          accessibilityLabel="Pregnancy name"
          accessibilityLabelledBy="pregnancy-display-name-label"
          accessibilityHint="Required. Maximum 100 characters. Presentation label only."
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
          accessibilityLabel="Create Pregnancy"
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
            <Text style={shellStyles.primaryButtonText}>Create Pregnancy</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel create Pregnancy"
          style={shellStyles.secondaryButton}
          disabled={submitting}
          onPress={() => {
            if (typeof familyId === "string") {
              router.replace(`/(app)/families/${familyId}/pregnancies`);
            } else {
              router.back();
            }
          }}
        >
          <Text style={shellStyles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
