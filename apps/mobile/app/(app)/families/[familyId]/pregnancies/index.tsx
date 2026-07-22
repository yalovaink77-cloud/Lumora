import { Link, Stack, router, useLocalSearchParams } from "expo-router";
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

import { useFamilyStore } from "../../../../../src/family/FamilyProvider";
import { usePregnancyStore } from "../../../../../src/pregnancy/PregnancyProvider";
import { formatPregnancyDate } from "../../../../../src/pregnancy/pregnancy-dto";
import { shellStyles } from "../../../../../src/ui/shell-styles";

export default function PregnanciesListScreen() {
  const params = useLocalSearchParams<{ familyId: string | string[] }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const family = useFamilyStore();
  const pregnancy = usePregnancyStore();

  useEffect(() => {
    if (typeof familyId === "string" && familyId.length > 0) {
      void pregnancy.loadPregnancies(familyId);
      if (family.detail?.id !== familyId && family.detailStatus !== "loading") {
        void family.loadFamilyDetail(familyId);
      }
    }

    return () => {
      pregnancy.clearDetail();
    };
  }, [familyId]);

  const refreshing = pregnancy.listStatus === "refreshing";
  const loading = pregnancy.listStatus === "loading";
  const listVisible =
    pregnancy.listStatus === "ready" || pregnancy.listStatus === "refreshing";
  const familyDetail = family.detail?.id === familyId ? family.detail : null;
  const familyLabel = familyDetail?.displayName ?? "this Family";

  if (typeof familyId !== "string" || familyId.length === 0) {
    return (
      <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Pregnancies" }} />
        <View style={shellStyles.scrollContent}>
          <Text style={shellStyles.title} accessibilityRole="header">
            Family not found
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Families"
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
      <Stack.Screen options={{ title: "Pregnancies" }} />
      <View style={[shellStyles.scrollContent, { flex: 1 }]}>
        <Text style={shellStyles.title} accessibilityRole="header">
          Pregnancies
        </Text>
        <Text style={shellStyles.subtitle}>
          Organizational Pregnancy records for {familyLabel}. These are not
          clinical records. Child and Timeline features are not part of this
          screen.
        </Text>

        {loading ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading pregnancies"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {pregnancy.listStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {pregnancy.listErrorMessage}
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

        {pregnancy.listStatus === "error" && pregnancy.listErrorMessage ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {pregnancy.listErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading pregnancies"
              style={shellStyles.primaryButton}
              onPress={() => {
                void pregnancy.loadPregnancies(familyId);
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {listVisible ? (
          <FlatList
            data={pregnancy.pregnancies}
            keyExtractor={(item) => item.id}
            accessibilityRole="list"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void pregnancy.refreshPregnancies(familyId);
                }}
                accessibilityLabel="Refresh pregnancies"
              />
            }
            ListHeaderComponent={
              pregnancy.pregnancies.length > 0 ? (
                <Link
                  href={`/(app)/families/${familyId}/pregnancies/create`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Pregnancy"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Pregnancy
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
                  You do not have any Pregnancies in this Family yet.
                </Text>
                <Link
                  href={`/(app)/families/${familyId}/pregnancies/create`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Pregnancy"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Pregnancy
                    </Text>
                  </Pressable>
                </Link>
              </View>
            }
            renderItem={({ item }) => (
              <Link
                href={`/(app)/families/${familyId}/pregnancies/${item.id}`}
                asChild
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open Pregnancy ${item.displayName}`}
                  style={shellStyles.listItem}
                >
                  <Text
                    style={shellStyles.listItemTitle}
                    numberOfLines={3}
                    accessibilityLabel={item.displayName}
                  >
                    {item.displayName}
                  </Text>
                  <Text style={shellStyles.listItemMeta}>
                    Created {formatPregnancyDate(item.createdAt)}
                  </Text>
                </Pressable>
              </Link>
            )}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Family"
          style={shellStyles.secondaryButton}
          onPress={() => {
            router.replace(`/(app)/families/${familyId}`);
          }}
        >
          <Text style={shellStyles.secondaryButtonText}>Back to Family</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
