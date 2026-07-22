import { Link, Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFamilyStore } from "../../../../../src/family/FamilyProvider";
import { usePregnancyStore } from "../../../../../src/pregnancy/PregnancyProvider";
import { formatPregnancyDate } from "../../../../../src/pregnancy/pregnancy-dto";
import { shellStyles } from "../../../../../src/ui/shell-styles";

export default function PregnancyDetailScreen() {
  const params = useLocalSearchParams<{
    familyId: string | string[];
    pregnancyId: string | string[];
  }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const pregnancyId = Array.isArray(params.pregnancyId)
    ? params.pregnancyId[0]
    : params.pregnancyId;
  const family = useFamilyStore();
  const pregnancy = usePregnancyStore();

  useEffect(() => {
    if (
      typeof familyId === "string" &&
      familyId.length > 0 &&
      typeof pregnancyId === "string" &&
      pregnancyId.length > 0
    ) {
      void pregnancy.loadPregnancyDetail(familyId, pregnancyId);
      if (family.detail?.id !== familyId && family.detailStatus !== "loading") {
        void family.loadFamilyDetail(familyId);
      }
    }

    return () => {
      pregnancy.clearDetail();
    };
  }, [familyId, pregnancyId]);

  const familyDetail = family.detail?.id === familyId ? family.detail : null;
  const familyLabel = familyDetail?.displayName ?? "this Family";

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: pregnancy.detail?.displayName ?? "Pregnancy",
        }}
      />
      <View style={shellStyles.scrollContent}>
        {pregnancy.detailStatus === "loading" ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading pregnancy"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {pregnancy.detailStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text style={shellStyles.title} accessibilityRole="header">
              Pregnancy not found
            </Text>
            <Text style={shellStyles.bodyText} accessibilityLiveRegion="polite">
              {pregnancy.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Pregnancies"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (typeof familyId === "string") {
                  router.replace(`/(app)/families/${familyId}/pregnancies`);
                } else {
                  router.replace("/(app)/families");
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>
                Back to Pregnancies
              </Text>
            </Pressable>
          </View>
        ) : null}

        {pregnancy.detailStatus === "error" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {pregnancy.detailErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading pregnancy"
              style={shellStyles.primaryButton}
              onPress={() => {
                if (
                  typeof familyId === "string" &&
                  typeof pregnancyId === "string"
                ) {
                  void pregnancy.loadPregnancyDetail(familyId, pregnancyId);
                }
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {pregnancy.detailStatus === "ready" && pregnancy.detail ? (
          <View>
            <Text
              style={shellStyles.title}
              accessibilityRole="header"
              accessibilityLabel={pregnancy.detail.displayName}
            >
              {pregnancy.detail.displayName}
            </Text>
            <Text style={shellStyles.bodyText}>
              Organizational record in {familyLabel}.
            </Text>
            <Text style={shellStyles.bodyText}>
              Created {formatPregnancyDate(pregnancy.detail.createdAt)}
            </Text>
            <Text style={shellStyles.bodyText}>
              Updated {formatPregnancyDate(pregnancy.detail.updatedAt)}
            </Text>
            <Text style={shellStyles.subtitle}>
              This is not a clinical pregnancy record. Health and AI features
              are not available on this screen.
            </Text>
            <Link
              href={`/(app)/families/${familyId}/pregnancies/${pregnancyId}/timeline`}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open Pregnancy Timeline"
                style={shellStyles.primaryButton}
              >
                <Text style={shellStyles.primaryButtonText}>Timeline</Text>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Pregnancies"
              style={shellStyles.secondaryButton}
              onPress={() => {
                if (typeof familyId === "string") {
                  router.replace(`/(app)/families/${familyId}/pregnancies`);
                } else {
                  router.back();
                }
              }}
            >
              <Text style={shellStyles.secondaryButtonText}>
                Back to Pregnancies
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
