import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { shellStyles } from "../ui/shell-styles";
import { useTimelineStore } from "./TimelineProvider";
import { formatTimelineOccurredAt } from "./timeline-occurred-at";
import type { TimelineSubjectType } from "./timeline.types";

export type TimelineDetailScreenProps = {
  familyId: string | undefined;
  subjectId: string | undefined;
  timelineEventId: string | undefined;
  subjectType: TimelineSubjectType;
  subjectLabel: string;
};

export function TimelineDetailScreen({
  familyId,
  subjectId,
  timelineEventId,
  subjectType,
  subjectLabel,
}: TimelineDetailScreenProps) {
  const timeline = useTimelineStore();

  useEffect(() => {
    if (
      typeof familyId === "string" &&
      familyId.length > 0 &&
      typeof subjectId === "string" &&
      subjectId.length > 0 &&
      typeof timelineEventId === "string" &&
      timelineEventId.length > 0
    ) {
      if (subjectType === "pregnancy") {
        void timeline.loadPregnancyTimelineEvent(
          familyId,
          subjectId,
          timelineEventId,
        );
      } else {
        void timeline.loadChildTimelineEvent(
          familyId,
          subjectId,
          timelineEventId,
        );
      }
    }

    return () => {
      timeline.clearDetail();
    };
  }, [familyId, subjectId, timelineEventId, subjectType]);

  const listHref =
    typeof familyId === "string" && typeof subjectId === "string"
      ? subjectType === "pregnancy"
        ? `/(app)/families/${familyId}/pregnancies/${subjectId}/timeline`
        : `/(app)/families/${familyId}/children/${subjectId}/timeline`
      : "/(app)/families";

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: timeline.detail?.title ?? "Timeline event",
        }}
      />
      <View style={shellStyles.scrollContent}>
        {timeline.detailStatus === "loading" ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading timeline event"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {timeline.detailStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text style={shellStyles.title} accessibilityRole="header">
              Timeline resource not found
            </Text>
            <Text style={shellStyles.bodyText} accessibilityLiveRegion="polite">
              {timeline.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Timeline"
              style={shellStyles.primaryButton}
              onPress={() => {
                router.replace(listHref);
              }}
            >
              <Text style={shellStyles.primaryButtonText}>
                Back to Timeline
              </Text>
            </Pressable>
          </View>
        ) : null}

        {timeline.detailStatus === "error" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {timeline.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading timeline event"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (
                  typeof familyId === "string" &&
                  typeof subjectId === "string" &&
                  typeof timelineEventId === "string"
                ) {
                  if (subjectType === "pregnancy") {
                    void timeline.loadPregnancyTimelineEvent(
                      familyId,
                      subjectId,
                      timelineEventId,
                    );
                  } else {
                    void timeline.loadChildTimelineEvent(
                      familyId,
                      subjectId,
                      timelineEventId,
                    );
                  }
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {timeline.detailStatus === "ready" && timeline.detail ? (
          <View>
            <Text
              style={shellStyles.title}
              accessibilityRole="header"
              accessibilityLabel={timeline.detail.title}
            >
              {timeline.detail.title}
            </Text>
            <Text
              style={shellStyles.bodyText}
              accessibilityLabel={`Occurred ${formatTimelineOccurredAt(timeline.detail.occurredAt)}`}
            >
              Occurred {formatTimelineOccurredAt(timeline.detail.occurredAt)}
            </Text>
            <Text style={shellStyles.bodyText}>
              User-authored Timeline note for {subjectLabel}. Not a medical
              record or verified milestone.
            </Text>
            <Text style={shellStyles.subtitle}>
              Displayed time uses this device’s timezone. Health, Media, and AI
              features are not available on this screen.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Timeline"
              style={shellStyles.secondaryButton}
              onPress={() => {
                router.replace(listHref);
              }}
            >
              <Text style={shellStyles.secondaryButtonText}>
                Back to Timeline
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
