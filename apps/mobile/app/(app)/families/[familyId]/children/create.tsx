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
import { useChildStore } from "../../../../../src/child/ChildProvider";
import { messageForChildValidationCode } from "../../../../../src/child/child-messages";
import {
  ChildClientValidationError,
  parseCreateChildInput,
} from "../../../../../src/child/child-validation";
import { shellStyles } from "../../../../../src/ui/shell-styles";

export default function CreateChildScreen() {
  const params = useLocalSearchParams<{ familyId: string | string[] }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const session = useAuthSession();
  const child = useChildStore();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (submitting || typeof familyId !== "string") {
      return;
    }

    setError(null);

    try {
      parseCreateChildInput({ displayName });
    } catch (validationError: unknown) {
      if (validationError instanceof ChildClientValidationError) {
        setError(messageForChildValidationCode(validationError.code));
        return;
      }
      setError(messageForChildValidationCode("DISPLAY_NAME_INVALID"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await child.createChild(familyId, displayName);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (
        session.status !== "authenticated" ||
        session.principal === null ||
        !result.child ||
        result.child.familyId !== familyId
      ) {
        return;
      }

      router.replace(`/(app)/families/${familyId}/children/${result.child.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Create Child" }} />
      <KeyboardAvoidingView
        style={shellStyles.scrollContent}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={shellStyles.title} accessibilityRole="header">
          Create Child
        </Text>
        <Text style={shellStyles.subtitle}>
          Choose a presentation label for this Child record. This is not a legal
          or verified name, medical identifier, or login identity.
        </Text>

        <Text style={shellStyles.label} nativeID="child-display-name-label">
          Child name
        </Text>
        <TextInput
          style={shellStyles.input}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect
          textContentType="nickname"
          accessibilityLabel="Child name"
          accessibilityLabelledBy="child-display-name-label"
          accessibilityHint="Required. Maximum 80 characters. Presentation label only."
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
          accessibilityLabel="Create Child"
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
            <Text style={shellStyles.primaryButtonText}>Create Child</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel create Child"
          style={shellStyles.secondaryButton}
          disabled={submitting}
          onPress={() => {
            if (typeof familyId === "string") {
              router.replace(`/(app)/families/${familyId}/children`);
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
