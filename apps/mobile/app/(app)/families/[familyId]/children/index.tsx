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

import { useChildStore } from "../../../../../src/child/ChildProvider";
import { formatChildDate } from "../../../../../src/child/child-dto";
import { useFamilyStore } from "../../../../../src/family/FamilyProvider";
import { shellStyles } from "../../../../../src/ui/shell-styles";

export default function ChildrenListScreen() {
  const params = useLocalSearchParams<{ familyId: string | string[] }>();
  const familyId = Array.isArray(params.familyId)
    ? params.familyId[0]
    : params.familyId;
  const family = useFamilyStore();
  const child = useChildStore();

  useEffect(() => {
    if (typeof familyId === "string" && familyId.length > 0) {
      void child.loadChildren(familyId);
      if (family.detail?.id !== familyId && family.detailStatus !== "loading") {
        void family.loadFamilyDetail(familyId);
      }
    }

    return () => {
      child.clearDetail();
    };
  }, [familyId]);

  const refreshing = child.listStatus === "refreshing";
  const loading = child.listStatus === "loading";
  const listVisible =
    child.listStatus === "ready" || child.listStatus === "refreshing";
  const familyDetail = family.detail?.id === familyId ? family.detail : null;
  const familyLabel = familyDetail?.displayName ?? "this Family";

  if (typeof familyId !== "string" || familyId.length === 0) {
    return (
      <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Children" }} />
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
      <Stack.Screen options={{ title: "Children" }} />
      <View style={[shellStyles.scrollContent, { flex: 1 }]}>
        <Text style={shellStyles.title} accessibilityRole="header">
          Children
        </Text>
        <Text style={shellStyles.subtitle}>
          Child presentation labels for {familyLabel}. Names are not legal or
          verified identities. Pregnancy linkage and Timeline features are not
          part of this screen.
        </Text>

        {loading ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading children"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {child.listStatus === "unavailable" ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {child.listErrorMessage}
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

        {child.listStatus === "error" && child.listErrorMessage ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {child.listErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading children"
              style={shellStyles.primaryButton}
              onPress={() => {
                void child.loadChildren(familyId);
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {listVisible ? (
          <FlatList
            data={child.children}
            keyExtractor={(item) => item.id}
            accessibilityRole="list"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void child.refreshChildren(familyId);
                }}
                accessibilityLabel="Refresh children"
              />
            }
            ListHeaderComponent={
              child.children.length > 0 ? (
                <Link
                  href={`/(app)/families/${familyId}/children/create`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Child"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Child
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
                  You do not have any Children in this Family yet.
                </Text>
                <Link
                  href={`/(app)/families/${familyId}/children/create`}
                  asChild
                >
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Child"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Child
                    </Text>
                  </Pressable>
                </Link>
              </View>
            }
            renderItem={({ item }) => (
              <Link
                href={`/(app)/families/${familyId}/children/${item.id}`}
                asChild
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open Child ${item.displayName}`}
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
                    Created {formatChildDate(item.createdAt)}
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
