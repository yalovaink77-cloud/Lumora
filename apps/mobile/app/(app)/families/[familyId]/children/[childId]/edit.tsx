import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../../../../../../src/auth/auth-session-context";
import { useChildStore } from "../../../../../../src/child/ChildProvider";
import { messageForChildValidationCode } from "../../../../../../src/child/child-messages";
import {
  ChildClientValidationError,
  parseUpdateChildDisplayNameInput,
} from "../../../../../../src/child/child-validation";
import { shellStyles } from "../../../../../../src/ui/shell-styles";

export default function EditChildDisplayNameScreen() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    childId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const childId = Array.isArray(params.childId)
    ? params.childId[0]
    : params.childId;
  const session = useAuthSession();
  const child = useChildStore();
  const [displayName, setDisplayName] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (
      typeof familyId !== "string" ||
      familyId.length === 0 ||
      typeof childId !== "string" ||
      childId.length === 0
    ) {
      return;
    }

    const detailReady =
      child.detailStatus === "ready" &&
      child.detail !== null &&
      child.detail.id === childId &&
      child.detail.familyId === familyId;

    if (detailReady) {
      return;
    }

    if (
      child.detailStatus === "loading" ||
      child.detailStatus === "unavailable" ||
      child.detailStatus === "error"
    ) {
      return;
    }

    void child.loadChildDetail(familyId, childId);
  }, [familyId, childId, child.detailStatus, child.detail]);

  useEffect(() => {
    if (
      prefilled ||
      child.detailStatus !== "ready" ||
      child.detail === null ||
      typeof childId !== "string" ||
      child.detail.id !== childId
    ) {
      return;
    }

    setDisplayName(child.detail.displayName);
    setPrefilled(true);
  }, [child.detail, child.detailStatus, childId, prefilled]);

  async function onSubmit() {
    if (
      submitting ||
      typeof familyId !== "string" ||
      typeof childId !== "string"
    ) {
      return;
    }

    setError(null);

    try {
      parseUpdateChildDisplayNameInput({ displayName });
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
      const result = await child.updateChildDisplayName(
        familyId,
        childId,
        displayName,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (
        session.status !== "authenticated" ||
        session.principal === null ||
        !result.child ||
        result.child.familyId !== familyId ||
        result.child.id !== childId
      ) {
        return;
      }

      router.replace(`/(app)/families/${familyId}/children/${childId}`);
    } finally {
      setSubmitting(false);
    }
  }

  const loadingDetail =
    !prefilled &&
    (child.detailStatus === "loading" || child.detailStatus === "idle");

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Edit Child name" }} />
      <KeyboardAvoidingView
        style={shellStyles.scrollContent}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={shellStyles.title} accessibilityRole="header">
          Edit display name
        </Text>
        <Text style={shellStyles.subtitle}>
          Update the presentation label only. This is not a legal or verified
          name, medical identifier, ownership evidence, or login identity.
        </Text>

        {loadingDetail ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading child"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {child.detailStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {child.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Children"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (typeof familyId === "string") {
                  router.replace(`/(app)/families/${familyId}/children`);
                } else {
                  router.replace("/(app)/families");
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>
                Back to Children
              </Text>
            </Pressable>
          </View>
        ) : null}

        {child.detailStatus === "error" && !prefilled ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {child.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading child"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (
                  typeof familyId === "string" &&
                  typeof childId === "string"
                ) {
                  void child.loadChildDetail(familyId, childId);
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {prefilled ? (
          <>
            <Text
              style={shellStyles.label}
              nativeID="child-edit-display-name-label"
            >
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
              accessibilityLabelledBy="child-edit-display-name-label"
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
              accessibilityLabel="Save Child display name"
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
                <Text style={shellStyles.primaryButtonText}>Save</Text>
              )}
            </Pressable>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel edit Child display name"
          style={shellStyles.secondaryButton}
          disabled={submitting}
          onPress={() => {
            if (typeof familyId === "string" && typeof childId === "string") {
              router.replace(`/(app)/families/${familyId}/children/${childId}`);
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
