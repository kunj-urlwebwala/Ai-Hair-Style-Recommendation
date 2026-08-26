import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type SavedLook, useConsultation } from "@/lib/consultation-context";

export default function SavedLooksScreen() {
  const router = useRouter();
  const { savedLooks, removeLook } = useConsultation();

  const confirmRemove = (look: SavedLook) => {
    Alert.alert("Remove this look?", `${look.recommendation.name} will be deleted from your shortlist.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeLook(look.id).catch(() => Alert.alert("Could not remove", "Please try again in a moment."));
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View><Text style={styles.logo}>MIRROR</Text><Text style={styles.kicker}>YOUR SHORTLIST</Text></View>
        <View style={styles.count}><Text style={styles.countText}>{savedLooks.length} SAVED</Text></View>
      </View>
      {savedLooks.length === 0 ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><IconSymbol name="heart.fill" size={26} color="#7A3E62" /></View>
        <Text style={styles.emptyTitle}>Nothing saved yet.</Text>
        <Text style={styles.emptyCopy}>When a look feels right, save it here to revisit before your salon appointment.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.navigate("/")} style={({ pressed }) => [styles.explore, pressed && styles.pressed]}><Text style={styles.exploreText}>Explore hairstyle directions</Text><IconSymbol name="arrow.right" size={18} color="#FFFFFF" /></Pressable>
      </View> : <FlatList data={savedLooks} keyExtractor={(look) => look.id} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.list} renderItem={({ item }) => <LookCard look={item} onRemove={() => confirmRemove(item)} />} />}
    </ScreenContainer>
  );
}

function LookCard({ look, onRemove }: { look: SavedLook; onRemove: () => void }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: look.previewImageUrl }} style={styles.image} contentFit="cover" />
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${look.recommendation.name}`} onPress={onRemove} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <IconSymbol name="xmark" size={12} color="#7A3E62" />
      </Pressable>
      <View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={1}>{look.recommendation.name}</Text><Text style={styles.cardMeta}>{look.recommendation.maintenance} upkeep</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 18, paddingBottom: 26, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { color: "#211D21", fontSize: 15, letterSpacing: 2.3, fontWeight: "800" }, kicker: { color: "#7A3E62", fontSize: 10, lineHeight: 15, letterSpacing: 1.1, fontWeight: "800", marginTop: 4 },
  count: { backgroundColor: "#F3E4E9", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }, countText: { color: "#7A3E62", fontSize: 10, letterSpacing: 0.5, fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80, paddingHorizontal: 26 }, emptyIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: "#F3E4E9", alignItems: "center", justifyContent: "center", marginBottom: 21 }, emptyTitle: { color: "#211D21", fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontWeight: "700" }, emptyCopy: { color: "#777073", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9, maxWidth: 285 },
  explore: { backgroundColor: "#7A3E62", borderRadius: 17, minHeight: 54, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 25 }, exploreText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  list: { paddingBottom: 30, gap: 13 }, row: { gap: 13 }, card: { flex: 1, maxWidth: "48.2%", backgroundColor: "#FFFFFF", borderRadius: 19, overflow: "hidden", borderWidth: 1, borderColor: "#E9DCE0", position: "relative" }, image: { width: "100%", aspectRatio: 0.77, backgroundColor: "#E7D4D7" }, remove: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E9DCE0" }, cardCopy: { padding: 11, gap: 3 }, cardTitle: { color: "#211D21", fontSize: 13, lineHeight: 17, fontWeight: "800" }, cardMeta: { color: "#8E8587", fontSize: 10, lineHeight: 13, fontWeight: "700" },
});
