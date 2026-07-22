import { Link, Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFamilyStore } from "../../../src/family/FamilyProvider";
import { formatFamilyDate } from "../../../src/family/family-dto";
import { shellStyles } from "../../../src/ui/shell-styles";

export default function FamilyDetailScreen() {
  const params = useLocalSearchParams<{ familyId: string | string[] }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const family = useFamilyStore();

  useEffect(() => {
    if (typeof familyId === "string" && familyId.length > 0) {
      void family.loadFamilyDetail(familyId);
    }

    return () => {
      family.clearDetail();
    };
  }, [familyId]);

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: family.detail?.displayName ?? "Family",
        }}
      />
      <View style={shellStyles.scrollContent}>
        {family.detailStatus === "loading" ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading family"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {family.detailStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text style={shellStyles.title} accessibilityRole="header">
              Family not found
            </Text>
            <Text style={shellStyles.bodyText} accessibilityLiveRegion="polite">
              {family.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Families"
              style={shellStyles.primaryButton}
              onPress={() => {
                router.replace("/(app)/families");
              }}
            >
              <Text style={shellStyles.primaryButtonText}>
                Back to Families
              </Text>
            </Pressable>
          </View>
        ) : null}

        {family.detailStatus === "error" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {family.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading family"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (typeof familyId === "string") {
                  void family.loadFamilyDetail(familyId);
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {family.detailStatus === "ready" && family.detail ? (
          <View>
            <Text
              style={shellStyles.title}
              accessibilityRole="header"
              accessibilityLabel={family.detail.displayName}
            >
              {family.detail.displayName}
            </Text>
            <Text style={shellStyles.bodyText}>
              Created {formatFamilyDate(family.detail.createdAt)}
            </Text>
            <Text style={shellStyles.bodyText}>
              Updated {formatFamilyDate(family.detail.updatedAt)}
            </Text>
            <Text style={shellStyles.subtitle}>
              Timeline and invitation features are not available on this screen.
            </Text>
            <Link
              href={`/(app)/families/${family.detail.id}/pregnancies`}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open Pregnancies"
                style={shellStyles.primaryButton}
              >
                <Text style={shellStyles.primaryButtonText}>Pregnancies</Text>
              </Pressable>
            </Link>
            <Link href={`/(app)/families/${family.detail.id}/children`} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open Children"
                style={shellStyles.primaryButton}
              >
                <Text style={shellStyles.primaryButtonText}>Children</Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Families"
              style={shellStyles.secondaryButton}
              onPress={() => {
                router.back();
              }}
            >
              <Text style={shellStyles.secondaryButtonText}>
                Back to Families
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
