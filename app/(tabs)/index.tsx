import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl } from "@/constants/api";
import { useConsultation } from "@/lib/consultation-context";
import { styleCatalog } from "@/shared/style-catalog";
import type { HairstyleRecommendation } from "@/shared/consultation";

type Page =
  | "home"
  | "photo"
  | "review"
  | "requirements"
  | "analyzing"
  | "profile"
  | "styles"
  | "preview";
type Portrait = {
  uri: string;
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};
type Occasion = "everyday" | "professional" | "festive" | "wedding" | "other";
type LengthPreference = "short" | "medium" | "long" | "open";
type MaintenancePreference = "low" | "medium" | "high" | "open";
const progress = [
  "Securing your portrait",
  "Reading visual balance",
  "Curating your styles",
  "Preparing your profile",
];

const tap = () =>
  Platform.OS !== "web" &&
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiClientError(
      payload?.error?.message ?? "The service could not complete this request.",
      payload?.error?.code,
    );
  return payload.data as T;
}

function Button({
  label,
  onPress,
  icon,
  outline = false,
}: {
  label: string;
  onPress: () => void;
  icon?: "arrow.right" | "sparkles" | "bookmark.fill" | "photo" | "camera";
  outline?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        outline ? styles.outlineButton : styles.button,
        pressed && styles.pressed,
      ]}
    >
      <Text style={outline ? styles.outlineLabel : styles.buttonLabel}>
        {label}
      </Text>
      {icon ? (
        <IconSymbol
          name={icon}
          size={18}
          color={outline ? "#7A3E62" : "#FFFFFF"}
        />
      ) : null}
    </Pressable>
  );
}

function Header({ onBack, label }: { onBack?: () => void; label?: string }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={styles.back}
        >
          <IconSymbol name="chevron.left" size={20} color="#211D21" />
        </Pressable>
      ) : (
        <Text style={styles.logo}>MIRROR</Text>
      )}
      <Text style={styles.headerLabel}>{label ?? "SALON INTELLIGENCE"}</Text>
      <View style={styles.headerBlank} />
    </View>
  );
}

export default function TryOnScreen() {
  const router = useRouter();
  const {
    consultation,
    setConsultation,
    setPreview,
    saveLook,
    removeLook,
    clearConsultation,
  } = useConsultation();
  const [page, setPage] = useState<Page>(consultation ? "preview" : "home");
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [selected, setSelected] = useState<HairstyleRecommendation | null>(
    null,
  );
  const [comparison, setComparison] = useState<"before" | "preview">("preview");
  const [step, setStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);

  const generateDirectGrid = useCallback(
    async (uri: string, base64: string, mimeType: string) => {
      setPage("analyzing");
      setStep(0);
      const timer = setInterval(
        () => setStep((value) => Math.min(value + 1, progress.length - 1)),
        1500,
      );
      try {
        const response = await postApi<{
          consultation: any;
          previewImageUrl: string;
        }>("/api/v1/hairstyle/direct-grid", {
          imageBase64: base64,
          mimeType: mimeType,
        });

        const { consultation: result, previewImageUrl } = response;
        const combinedStyle = {
          id: "all_styles_grid",
          name: "4-in-1 Style Grid",
          description: "A 2x2 grid collage of all 4 recommended styles.",
          whyItWorks:
            "Seeing all options side-by-side helps you compare maintenance, texture, and visual balance at once.",
          maintenance: "Medium",
          texture: "Mixed",
          tone: "Mixed",
          prompt: "",
        } as any;

        const nextConsultation = {
          id: result.id,
          sourceImageUri: uri,
          sourceImageUrl: result.sourceImageUrl,
          analysis: result.analysis,
          recommendations: result.recommendations,
          previews: { all_styles_grid: previewImageUrl },
        };

        setConsultation(nextConsultation);
        setSelected(combinedStyle);
        setComparison("preview");
        setPage("preview");
        Platform.OS !== "web" &&
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => undefined);
      } catch (error) {
        setPage("home");
        Alert.alert(
          "Generation paused",
          error instanceof Error
            ? error.message
            : "Please check your connection and try again.",
        );
      } finally {
        clearInterval(timer);
      }
    },
    [setConsultation],
  );

  const selectPortrait = useCallback(
    async (camera: boolean) => {
      try {
        const permission = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Permission needed",
            "Please allow access in your device settings.",
          );
          return;
        }
        const options = {
          allowsEditing: true,
          aspect: [3, 4] as [number, number],
          quality: 0.82,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        };
        const result = camera
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset.base64)
          throw new Error("The selected image could not be prepared.");
        const mimeType =
          asset.mimeType === "image/png" || asset.mimeType === "image/webp"
            ? asset.mimeType
            : "image/jpeg";
        setPortrait({ uri: asset.uri, base64: asset.base64, mimeType });
        generateDirectGrid(asset.uri, asset.base64, mimeType);
      } catch (error) {
        Alert.alert(
          "Unable to use this photo",
          error instanceof Error
            ? error.message
            : "Please choose another portrait.",
        );
      }
    },
    [generateDirectGrid],
  );

  const startFlow = useCallback(() => {
    clearConsultation();
    setPortrait(null);
    setPage("photo");
  }, [clearConsultation]);

  const startFromCatalog = useCallback(
    (style: HairstyleRecommendation) => {
      clearConsultation();
      setPortrait(null);
      setPage("photo");
    },
    [clearConsultation],
  );

  const saveCurrentLook = useCallback(async () => {
    if (!selected) return;
    try {
      await saveLook(selected);
      Alert.alert(
        "Saved to your edit",
        "You can compare this look anytime from the Saved tab.",
      );
    } catch (error) {
      Alert.alert(
        "Could not save",
        error instanceof Error
          ? error.message
          : "Please try again in a moment.",
      );
    }
  }, [saveLook, selected]);

  if (page === "home")
    return (
      <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.home}
          showsVerticalScrollIndicator={false}
        >
          <Header />
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>YOUR NEXT LOOK, MADE VISIBLE</Text>
            <Text style={styles.heroTitle}>
              Meet the hair that feels like you.
            </Text>
            <Text style={styles.body}>
              Upload one portrait and receive thoughtful style directions plus
              realistic hairstyle previews made around your original face.
            </Text>
          </View>
          <View style={styles.heroCard}>
            <View style={styles.aura} />
            <View style={styles.avatar}>
              <View style={styles.avatarHair} />
              <View style={styles.avatarFace}>
                <View style={styles.avatarEyes}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <View style={styles.avatarMouth} />
              </View>
            </View>
            <View style={styles.cardCaption}>
              <Text style={styles.captionTitle}>
                A consultation, not a filter
              </Text>
              <Text style={styles.captionBody}>
                Your face stays yours. Only the hairstyle changes.
              </Text>
            </View>
          </View>
          <View style={styles.steps}>
            {[
              [
                "01",
                "Share a clear portrait",
                "A front-facing photo works best.",
              ],
              [
                "02",
                "See tailored directions",
                "Get four styles with practical rationale.",
              ],
              [
                "03",
                "Try on before you commit",
                "Compare your original with each look.",
              ],
            ].map(([n, title, copy]) => (
              <View key={n} style={styles.stepRow}>
                <Text style={styles.stepNo}>{n}</Text>
                <View>
                  <Text style={styles.stepTitle}>{title}</Text>
                  <Text style={styles.stepCopy}>{copy}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.kicker, styles.libraryLabel]}>
            STYLE LIBRARY
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.library}
          >
            {styleCatalog.map((style) => (
              <Pressable
                key={style.id}
                accessibilityRole="button"
                onPress={() => startFromCatalog(style)}
                style={({ pressed }) => [
                  styles.libraryCard,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.libraryName} numberOfLines={1}>
                  {style.name}
                </Text>
                <Text style={styles.libraryMeta}>
                  {style.maintenance} upkeep · {style.texture}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.privacy}>
            <Text style={styles.privacyMark}>✦</Text>
            <Text style={styles.privacyText}>
              Your image is used only to prepare this consultation and preview.
            </Text>
          </View>
          <Button
            label="Start my try-on"
            icon="arrow.right"
            onPress={startFlow}
          />
        </ScrollView>
      </ScreenContainer>
    );

  if (page === "photo")
    return (
      <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
        <Header onBack={() => setPage("home")} label="STEP 1 OF 3" />
        <View style={styles.center}>
          <Text style={styles.kicker}>START WITH A PORTRAIT</Text>
          <Text style={styles.title}>Show us your natural frame.</Text>
          <Text style={styles.body}>
            Use a recent photo in even light. Keep your face fully visible and
            avoid hats, sunglasses, or beauty filters.
          </Text>
          <View style={styles.guide}>
            <View style={styles.guideHead}>
              <View style={styles.guideHair} />
              <View style={styles.guideFace}>
                <View style={styles.avatarEyes}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <View style={styles.avatarMouth} />
              </View>
            </View>
            <Text style={styles.guideText}>
              FRONT-FACING · EYE LEVEL · DAYLIGHT
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            label="Use photo library"
            icon="photo"
            outline
            onPress={() => selectPortrait(false)}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => selectPortrait(true)}
            style={styles.cameraAction}
          >
            <IconSymbol name="camera" size={18} color="#211D21" />
            <Text style={styles.cameraLabel}>Take a new photo</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );

  if (page === "analyzing")
    return (
      <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
        <View style={styles.analyzing}>
          <View style={styles.miniPortrait}>
            {portrait && (
              <Image
                source={{ uri: portrait.uri }}
                style={styles.miniImage}
                contentFit="cover"
              />
            )}
            <View style={styles.ring} />
          </View>
          <Text style={styles.kicker}>GENERATING YOUR LOOKS</Text>
          <Text style={styles.title}>Creating 4-in-1 Grid.</Text>
          <Text style={styles.body}>
            This might take a minute as we perfectly style all four directions
            on your face while preserving your identity.
          </Text>
          <View style={styles.progress}>
            {progress.map((item, index) => (
              <View
                key={item}
                style={[
                  styles.progressBar,
                  index <= step && styles.progressActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.status}>
            <ActivityIndicator size="small" color="#7A3E62" />
            <Text style={styles.statusText}>{progress[step]}</Text>
          </View>
        </View>
      </ScreenContainer>
    );

  if (page === "preview" && consultation && selected && portrait) {
    const generated = consultation.previews[selected.id];
    return (
      <ScreenContainer className="px-5" edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={previewStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <Header onBack={() => setPage("home")} label="VIRTUAL TRY-ON" />
          <View style={styles.previewIntro}>
            <Text style={styles.kicker}>YOUR CUSTOM LOOKS</Text>
            <Text style={styles.previewTitle}>
              {generated
                ? "4 directions, still unmistakably you."
                : "Creating your preview."}
            </Text>
          </View>
          <View
            style={
              selected.id === "all_styles_grid"
                ? styles.previewFrameSquare
                : styles.previewFrame
            }
          >
            <>
              <Image
                source={{
                  uri:
                    comparison === "preview" && generated
                      ? generated
                      : portrait.uri,
                }}
                style={styles.previewImage}
                contentFit={comparison === "before" ? "contain" : "cover"}
              />
              {comparison === "preview" &&
                generated &&
                selected.id === "all_styles_grid" && (
                  <>
                    <View style={previewStyles.q1Cell}>
                      <View style={previewStyles.overlayLabel}>
                        <View style={previewStyles.overlayNumberBox}>
                          <Text style={previewStyles.overlayNumber}>1</Text>
                        </View>
                        <Text
                          style={previewStyles.overlayName}
                          numberOfLines={1}
                        >
                          {consultation.recommendations[0]?.name}
                        </Text>
                      </View>
                    </View>
                    <View style={previewStyles.q2Cell}>
                      <View style={previewStyles.overlayLabel}>
                        <View style={previewStyles.overlayNumberBox}>
                          <Text style={previewStyles.overlayNumber}>2</Text>
                        </View>
                        <Text
                          style={previewStyles.overlayName}
                          numberOfLines={1}
                        >
                          {consultation.recommendations[1]?.name}
                        </Text>
                      </View>
                    </View>
                    <View style={previewStyles.q3Cell}>
                      <View style={previewStyles.overlayLabel}>
                        <View style={previewStyles.overlayNumberBox}>
                          <Text style={previewStyles.overlayNumber}>3</Text>
                        </View>
                        <Text
                          style={previewStyles.overlayName}
                          numberOfLines={1}
                        >
                          {consultation.recommendations[2]?.name}
                        </Text>
                      </View>
                    </View>
                    <View style={previewStyles.q4Cell}>
                      <View style={previewStyles.overlayLabel}>
                        <View style={previewStyles.overlayNumberBox}>
                          <Text style={previewStyles.overlayNumber}>4</Text>
                        </View>
                        <Text
                          style={previewStyles.overlayName}
                          numberOfLines={1}
                        >
                          {consultation.recommendations[3]?.name}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
            </>
          </View>
          {generated && (
            <View style={styles.toggle}>
              <Pressable
                onPress={() => setComparison("before")}
                style={[
                  styles.toggleOption,
                  comparison === "before" && styles.toggleOn,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    comparison === "before" && styles.toggleTextOn,
                  ]}
                >
                  Before
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setComparison("preview")}
                style={[
                  styles.toggleOption,
                  comparison === "preview" && styles.toggleOn,
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    comparison === "preview" && styles.toggleTextOn,
                  ]}
                >
                  Preview
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.previewCopy}>
            <Text style={styles.previewStyle}>{selected.name}</Text>
            <Text style={styles.previewBody}>{selected.whyItWorks}</Text>
          </View>
          {generated && (
            <View style={styles.actions}>
              <Button
                label="Save this look"
                icon="bookmark.fill"
                onPress={saveCurrentLook}
              />
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  home: { paddingTop: 16, paddingBottom: 30, gap: 25 },
  header: {
    height: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    color: "#211D21",
    fontSize: 15,
    letterSpacing: 2.3,
    fontWeight: "800",
  },
  headerLabel: {
    color: "#8E8587",
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: "800",
  },
  headerBlank: { width: 38 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E9DCE0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "#7A3E62",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.3,
    fontWeight: "800",
  },
  heroCopy: { gap: 10, marginTop: 14 },
  heroTitle: {
    color: "#211D21",
    fontSize: 42,
    lineHeight: 47,
    letterSpacing: -1.35,
    fontWeight: "700",
  },
  title: {
    color: "#211D21",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    fontWeight: "700",
    marginTop: 9,
  },
  body: { color: "#665D60", fontSize: 15, lineHeight: 23, marginTop: 10 },
  libraryLabel: { marginTop: 4 },
  library: { gap: 9, paddingRight: 20 },
  libraryCard: {
    borderWidth: 1,
    borderColor: "#E4D4D9",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    maxWidth: 220,
  },
  libraryName: { color: "#211D21", fontSize: 13, fontWeight: "800" },
  libraryMeta: {
    color: "#8E8587",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  heroCard: {
    height: 299,
    borderRadius: 28,
    backgroundColor: "#F1DDE4",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  aura: {
    position: "absolute",
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "#E2BFCB",
    top: -165,
  },
  avatar: {
    height: 202,
    width: 160,
    alignItems: "center",
    position: "relative",
    marginBottom: 45,
  },
  avatarHair: {
    width: 158,
    height: 193,
    borderTopLeftRadius: 78,
    borderTopRightRadius: 78,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    backgroundColor: "#3B2829",
    position: "absolute",
  },
  avatarFace: {
    marginTop: 26,
    width: 108,
    height: 147,
    borderRadius: 56,
    backgroundColor: "#D9A790",
    alignItems: "center",
    paddingTop: 51,
    zIndex: 1,
  },
  avatarEyes: { flexDirection: "row", gap: 26 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#392729" },
  avatarMouth: {
    marginTop: 22,
    width: 22,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#A4525C",
  },
  cardCaption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    padding: 13,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.86)",
    gap: 3,
  },
  captionTitle: { color: "#211D21", fontSize: 14, fontWeight: "800" },
  captionBody: { color: "#665D60", fontSize: 12, lineHeight: 17 },
  steps: { gap: 17 },
  stepRow: { flexDirection: "row", gap: 13 },
  stepNo: {
    color: "#7A3E62",
    backgroundColor: "#F2E6E8",
    borderRadius: 13,
    width: 31,
    height: 25,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 10,
    fontWeight: "800",
  },
  stepTitle: {
    color: "#211D21",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  stepCopy: { color: "#8E8587", fontSize: 13, lineHeight: 19, marginTop: 1 },
  privacy: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E9DCE0",
  },
  privacyMark: { color: "#5F7E70", fontSize: 15 },
  privacyText: { flex: 1, color: "#777073", fontSize: 12, lineHeight: 17 },
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#7A3E62",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  buttonLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  outlineButton: {
    height: 55,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#7A3E62",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  outlineLabel: { color: "#7A3E62", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  center: { flex: 1, alignItems: "center", paddingTop: 35 },
  guide: {
    width: "100%",
    height: 285,
    marginTop: 30,
    borderRadius: 28,
    backgroundColor: "#F2E5E5",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C99DA9",
    alignItems: "center",
    justifyContent: "center",
    gap: 17,
  },
  guideHead: {
    width: 116,
    height: 156,
    alignItems: "center",
    position: "relative",
  },
  guideHair: {
    width: 116,
    height: 145,
    borderTopLeftRadius: 58,
    borderTopRightRadius: 58,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: "#C99DA9",
    position: "absolute",
  },
  guideFace: {
    width: 76,
    height: 110,
    borderRadius: 40,
    marginTop: 22,
    backgroundColor: "#E8C7BB",
    zIndex: 1,
    alignItems: "center",
    paddingTop: 38,
  },
  guideText: {
    color: "#7A3E62",
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "800",
  },
  actions: { paddingBottom: 18, paddingTop: 12, gap: 10 },
  cameraAction: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cameraLabel: { color: "#211D21", fontSize: 14, fontWeight: "800" },
  analyzing: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  miniPortrait: { width: 132, height: 132, borderRadius: 66, marginBottom: 32 },
  miniImage: { width: "100%", height: "100%", borderRadius: 66 },
  ring: {
    position: "absolute",
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 2,
    borderColor: "#7A3E62",
    borderTopColor: "#E2BFCB",
    top: -11,
    left: -11,
  },
  progress: { width: "100%", flexDirection: "row", gap: 6, marginTop: 38 },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E9DCE0",
  },
  progressActive: { backgroundColor: "#7A3E62" },
  status: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 9 },
  statusText: { color: "#7A3E62", fontSize: 13, fontWeight: "800" },
  previewIntro: { paddingTop: 17, paddingBottom: 16, gap: 3 },
  previewTitle: {
    color: "#211D21",
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.7,
    fontWeight: "700",
  },
  previewFrameSquare: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    aspectRatio: 1,
    backgroundColor: "#E7D4D7",
    borderRadius: 27,
    overflow: "hidden",
  },
  previewFrame: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    height: 376,
    backgroundColor: "#E7D4D7",
    borderRadius: 27,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%" },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#F0E6E7",
    marginTop: 14,
  },
  toggleOption: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#FFFFFF" },
  toggleText: { color: "#8E8587", fontSize: 13, fontWeight: "800" },
  toggleTextOn: { color: "#211D21" },
  previewCopy: { paddingTop: 17, gap: 4 },
  previewStyle: { color: "#211D21", fontSize: 17, fontWeight: "800" },
  previewBody: { color: "#665D60", fontSize: 13, lineHeight: 19 },
});

const previewStyles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 28,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  overlayLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28, 22, 26, 0.90)",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 7,
    gap: 6,
    width: "92%",
    borderWidth: 1,
    borderColor: "rgba(233, 220, 224, 0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  overlayNumberBox: {
    width: 17,
    height: 17,
    backgroundColor: "#7A3E62",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayNumber: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  overlayName: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  q1Cell: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "50%",
    height: "50%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  q2Cell: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: "50%",
    height: "50%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  q3Cell: {
    position: "absolute",
    top: "50%",
    left: 0,
    width: "50%",
    height: "50%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  q4Cell: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "50%",
    height: "50%",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
});
