import { Link, Stack, router } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { shellStyles } from "../ui/shell-styles";
import { useTimelineStore } from "./TimelineProvider";
import { formatTimelineOccurredAt } from "./timeline-occurred-at";
import type { TimelineSubjectType } from "./timeline.types";

export type TimelineListScreenProps = {
  familyId: string | undefined;
  subjectId: string | undefined;
  subjectType: TimelineSubjectType;
  subjectLabel: string;
};

export function TimelineListScreen({
  familyId,
  subjectId,
  subjectType,
  subjectLabel,
}: TimelineListScreenProps) {
  const timeline = useTimelineStore();

  useEffect(() => {
    if (
      typeof familyId === "string" &&
      familyId.length > 0 &&
      typeof subjectId === "string" &&
      subjectId.length > 0
    ) {
      if (subjectType === "pregnancy") {
        void timeline.loadPregnancyTimeline(familyId, subjectId);
      } else {
        void timeline.loadChildTimeline(familyId, subjectId);
      }
    }

    return () => {
      timeline.clearDetail();
    };
  }, [familyId, subjectId, subjectType]);

  const refreshing = timeline.listStatus === "refreshing";
  const loading = timeline.listStatus === "loading";
  const listVisible =
    timeline.listStatus === "ready" || timeline.listStatus === "refreshing";

  const listBase =
    typeof familyId === "string" && typeof subjectId === "string"
      ? subjectType === "pregnancy"
        ? `/(app)/families/${familyId}/pregnancies/${subjectId}/timeline`
        : `/(app)/families/${familyId}/children/${subjectId}/timeline`
      : null;

  const subjectDetailHref =
    typeof familyId === "string" && typeof subjectId === "string"
      ? subjectType === "pregnancy"
        ? `/(app)/families/${familyId}/pregnancies/${subjectId}`
        : `/(app)/families/${familyId}/children/${subjectId}`
      : "/(app)/families";

  if (
    typeof familyId !== "string" ||
    familyId.length === 0 ||
    typeof subjectId !== "string" ||
    subjectId.length === 0 ||
    !listBase
  ) {
    return (
      <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Timeline" }} />
        <View style={shellStyles.scrollContent}>
          <Text style={shellStyles.title} accessibilityRole="header">
            Timeline resource not found
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={shellStyles.primaryButton}
            onPress={() => {
              router.replace("/(app)/families");
            }}
          >
            <Text style={shellStyles.primaryButtonText}>Back to Families</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Timeline" }} />
      <View style={[shellStyles.scrollContent, { flex: 1 }]}>
        <Text style={shellStyles.title} accessibilityRole="header">
          Timeline
        </Text>
        <Text style={shellStyles.subtitle}>
          User-authored Timeline notes for {subjectLabel}. These are unverified
          historical statements, not medical records or verified milestones.
        </Text>

        {loading ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading timeline"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {timeline.listStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {timeline.listErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to subject"
              style={shellStyles.primaryButton}
              onPress={() => {
                router.replace(subjectDetailHref);
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Back</Text>
            </Pressable>
          </View>
        ) : null}

        {timeline.listStatus === "error" && timeline.listErrorMessage ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {timeline.listErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading timeline"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (subjectType === "pregnancy") {
                  void timeline.loadPregnancyTimeline(familyId, subjectId);
                } else {
                  void timeline.loadChildTimeline(familyId, subjectId);
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {listVisible ? (
          <FlatList
            data={timeline.events}
            keyExtractor={(item) => item.id}
            accessibilityRole="list"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (subjectType === "pregnancy") {
                    void timeline.refreshPregnancyTimeline(familyId, subjectId);
                  } else {
                    void timeline.refreshChildTimeline(familyId, subjectId);
                  }
                }}
                accessibilityLabel="Refresh timeline"
              />
            }
            ListHeaderComponent={
              timeline.events.length > 0 ? (
                <Link href={`${listBase}/create`} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create Timeline event"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create event
                    </Text>
                  </Pressable>
                </Link>
              ) : null
            }
            ListEmptyComponent={
              <View>
                <Text
                  style={shellStyles.bodyText}
                  accessibilityLiveRegion="polite"
                >
                  No Timeline events yet.
                </Text>
                <Link href={`${listBase}/create`} asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create Timeline event"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create event
                    </Text>
                  </Pressable>
                </Link>
              </View>
            }
            renderItem={({ item }) => (
              <Link href={`${listBase}/${item.id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open Timeline event ${item.title}, ${formatTimelineOccurredAt(item.occurredAt)}`}
                  style={shellStyles.listItem}
                >
                  <Text
                    style={shellStyles.listItemTitle}
                    numberOfLines={3}
                    accessibilityLabel={item.title}
                  >
                    {item.title}
                  </Text>
                  <Text style={shellStyles.listItemMeta}>
                    {formatTimelineOccurredAt(item.occurredAt)}
                  </Text>
                </Pressable>
              </Link>
            )}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to subject detail"
          style={shellStyles.secondaryButton}
          onPress={() => {
            router.replace(subjectDetailHref);
          }}
        >
          <Text style={shellStyles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
