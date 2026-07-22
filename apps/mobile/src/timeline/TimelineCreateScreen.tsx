import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthSession } from "../auth/auth-session-context";
import { shellStyles } from "../ui/shell-styles";
import {
  TimelineOccurredAtFields,
  createInitialOccurredAtSelection,
} from "./TimelineOccurredAtFields";
import { useTimelineStore } from "./TimelineProvider";
import { messageForTimelineValidationCode } from "./timeline-messages";
import {
  TimelineClientValidationError,
  parseCreateTimelineEventInput,
} from "./timeline-validation";
import type { TimelineSubjectType } from "./timeline.types";

export type TimelineCreateScreenProps = {
  familyId: string | undefined;
  subjectId: string | undefined;
  subjectType: TimelineSubjectType;
};

export function TimelineCreateScreen({
  familyId,
  subjectId,
  subjectType,
}: TimelineCreateScreenProps) {
  const session = useAuthSession();
  const timeline = useTimelineStore();
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    createInitialOccurredAtSelection,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const listHref =
    typeof familyId === "string" && typeof subjectId === "string"
      ? subjectType === "pregnancy"
        ? `/(app)/families/${familyId}/pregnancies/${subjectId}/timeline`
        : `/(app)/families/${familyId}/children/${subjectId}/timeline`
      : null;

  async function onSubmit() {
    if (
      submitting ||
      typeof familyId !== "string" ||
      typeof subjectId !== "string" ||
      !listHref
    ) {
      return;
    }

    setError(null);

    let body: { title: string; occurredAt: string };
    try {
      body = parseCreateTimelineEventInput({
        title,
        occurredAt: occurredAt.selected,
        occurredAtConfirmed: occurredAt.confirmed,
      });
    } catch (validationError: unknown) {
      if (validationError instanceof TimelineClientValidationError) {
        setError(messageForTimelineValidationCode(validationError.code));
        return;
      }
      setError(messageForTimelineValidationCode("TITLE_INVALID"));
      return;
    }

    setSubmitting(true);
    try {
      const result =
        subjectType === "pregnancy"
          ? await timeline.createPregnancyTimelineEvent(
              familyId,
              subjectId,
              body.title,
              body.occurredAt,
            )
          : await timeline.createChildTimelineEvent(
              familyId,
              subjectId,
              body.title,
              body.occurredAt,
            );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (
        session.status !== "authenticated" ||
        session.principal === null ||
        !result.event ||
        result.event.familyId !== familyId
      ) {
        return;
      }

      router.replace(`${listHref}/${result.event.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Create Timeline event" }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={shellStyles.scrollContent}>
          <Text style={shellStyles.title} accessibilityRole="header">
            Create Timeline event
          </Text>
          <Text style={shellStyles.subtitle}>
            Record a user-authored historical note. This is not a medical
            record, verified milestone, or clinical observation.
          </Text>

          <Text style={shellStyles.label} nativeID="timeline-title-label">
            Title
          </Text>
          <TextInput
            style={shellStyles.input}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            autoCorrect
            accessibilityLabel="Timeline title"
            accessibilityLabelledBy="timeline-title-label"
            accessibilityHint="Required. Maximum 80 characters."
            editable={!submitting}
          />

          <TimelineOccurredAtFields
            value={occurredAt}
            onChange={setOccurredAt}
            disabled={submitting}
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
            accessibilityLabel="Create Timeline event"
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
              <Text style={shellStyles.primaryButtonText}>Create event</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel create Timeline event"
            style={shellStyles.secondaryButton}
            disabled={submitting}
            onPress={() => {
              if (listHref) {
                router.replace(listHref);
              } else {
                router.back();
              }
            }}
          >
            <Text style={shellStyles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
