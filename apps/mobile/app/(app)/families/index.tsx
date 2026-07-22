import { Link, Stack } from "expo-router";
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

import { useFamilyStore } from "../../../src/family/FamilyProvider";
import { formatFamilyDate } from "../../../src/family/family-dto";
import { shellStyles } from "../../../src/ui/shell-styles";

export default function FamiliesListScreen() {
  const family = useFamilyStore();

  useEffect(() => {
    void family.loadFamilies();
  }, []);

  const refreshing = family.listStatus === "refreshing";
  const loading = family.listStatus === "loading";
  const listVisible =
    family.listStatus === "ready" || family.listStatus === "refreshing";

  return (
    <SafeAreaView style={shellStyles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Families" }} />
      <View style={[shellStyles.scrollContent, { flex: 1 }]}>
        <Text style={shellStyles.title} accessibilityRole="header">
          Families
        </Text>
        <Text style={shellStyles.subtitle}>
          Families you can access. Pregnancy and Child features are not part of
          this screen.
        </Text>

        {loading ? (
          <View
            style={shellStyles.centered}
            accessibilityLabel="Loading families"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator accessibilityLabel="Loading" />
          </View>
        ) : null}

        {family.listErrorMessage ? (
          <View accessibilityRole="alert">
            <Text
              style={shellStyles.errorText}
              accessibilityLiveRegion="polite"
            >
              {family.listErrorMessage}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading families"
              style={shellStyles.primaryButton}
              onPress={() => {
                void family.loadFamilies();
              }}
            >
              <Text style={shellStyles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {listVisible ? (
          <FlatList
            data={family.families}
            keyExtractor={(item) => item.id}
            accessibilityRole="list"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void family.refreshFamilies();
                }}
                accessibilityLabel="Refresh families"
              />
            }
            ListHeaderComponent={
              family.families.length > 0 ? (
                <Link href="/(app)/families/create" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Family"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Family
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
                  You do not have any Families yet.
                </Text>
                <Link href="/(app)/families/create" asChild>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Create a Family"
                    style={shellStyles.primaryButton}
                  >
                    <Text style={shellStyles.primaryButtonText}>
                      Create Family
                    </Text>
                  </Pressable>
                </Link>
              </View>
            }
            renderItem={({ item }) => (
              <Link href={`/(app)/families/${item.id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open Family ${item.displayName}`}
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
                    Created {formatFamilyDate(item.createdAt)}
                  </Text>
                </Pressable>
              </Link>
            )}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
