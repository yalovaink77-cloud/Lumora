import { Link, Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useChildStore } from "../../../../../../src/child/ChildProvider";
import { formatChildDate } from "../../../../../../src/child/child-dto";
import { useFamilyStore } from "../../../../../../src/family/FamilyProvider";
import { shellStyles } from "../../../../../../src/ui/shell-styles";

export default function ChildDetailScreen() {
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
  const family = useFamilyStore();
  const child = useChildStore();

  useEffect(() => {
    if (
      typeof familyId === "string" &&
      familyId.length > 0 &&
      typeof childId === "string" &&
      childId.length > 0
    ) {
      void child.loadChildDetail(familyId, childId);
      if (family.detail?.id !== familyId && family.detailStatus !== "loading") {
        void family.loadFamilyDetail(familyId);
      }
    }

    return () => {
      child.clearDetail();
    };
  }, [familyId, childId]);

  const familyDetail = family.detail?.id === familyId ? family.detail : null;
  const familyLabel = familyDetail?.displayName ?? "this Family";

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: child.detail?.displayName ?? "Child",
        }}
      />
      <View style={shellStyles.scrollContent}>
        {child.detailStatus === "loading" ? (
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
            <Text style={shellStyles.title} accessibilityRole="header">
              Child not found
            </Text>
            <Text style={shellStyles.bodyText} accessibilityLiveRegion="polite">
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

        {child.detailStatus === "error" ? (
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

        {child.detailStatus === "ready" && child.detail ? (
          <View>
            <Text
              style={shellStyles.title}
              accessibilityRole="header"
              accessibilityLabel={child.detail.displayName}
            >
              {child.detail.displayName}
            </Text>
            <Text style={shellStyles.bodyText}>
              Presentation label in {familyLabel}.
            </Text>
            <Text style={shellStyles.bodyText}>
              Created {formatChildDate(child.detail.createdAt)}
            </Text>
            <Text style={shellStyles.bodyText}>
              Updated {formatChildDate(child.detail.updatedAt)}
            </Text>
            <Text style={shellStyles.subtitle}>
              This name is not a legal or verified identity, medical identifier,
              ownership evidence, or login account. Timeline, Pregnancy linkage,
              Health, and AI features are not available on this screen.
            </Text>
            <Link
              href={`/(app)/families/${familyId}/children/${childId}/edit`}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Edit Child display name"
                style={shellStyles.primaryButton}
              >
                <Text style={shellStyles.primaryButtonText}>
                  Edit display name
                </Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Children"
              style={shellStyles.secondaryButton}
              onPress={() => {
                if (typeof familyId === "string") {
                  router.replace(`/(app)/families/${familyId}/children`);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={shellStyles.secondaryButtonText}>
                Back to Children
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
