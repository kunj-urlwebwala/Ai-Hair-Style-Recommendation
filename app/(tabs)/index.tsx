import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl } from "@/constants/api";
import { useAuth } from "@/hooks/use-auth";
import { getSessionToken } from "@/lib/_core/auth";
import { useConsultation } from "@/lib/consultation-context";
import { styleCatalog } from "@/shared/style-catalog";
import type { HairstyleRecommendation } from "@/shared/consultation";

type Page = "home" | "photo" | "review" | "requirements" | "analyzing" | "profile" | "styles" | "preview";
type Portrait = { uri: string; base64: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };
type Occasion = "everyday" | "professional" | "festive" | "wedding" | "other";
type LengthPreference = "short" | "medium" | "long" | "open";
type MaintenancePreference = "low" | "medium" | "high" | "open";
const progress = ["Securing your portrait", "Reading visual balance", "Curating your styles", "Preparing your profile"];

const tap = () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

class ApiClientError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function postApi<T>(path: string, body: unknown): Promise<T> {
  const sessionToken = await getSessionToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(payload?.error?.message ?? "The service could not complete this request.", payload?.error?.code);
  return payload.data as T;
}

function Button({ label, onPress, icon, outline = false }: { label: string; onPress: () => void; icon?: "arrow.right" | "sparkles" | "bookmark.fill" | "photo" | "camera"; outline?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => [outline ? styles.outlineButton : styles.button, pressed && styles.pressed]}><Text style={outline ? styles.outlineLabel : styles.buttonLabel}>{label}</Text>{icon ? <IconSymbol name={icon} size={18} color={outline ? "#7A3E62" : "#FFFFFF"} /> : null}</Pressable>;
}

function Header({ onBack, label }: { onBack?: () => void; label?: string }) {
  return <View style={styles.header}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}><IconSymbol name="chevron.left" size={20} color="#211D21" /></Pressable> : <Text style={styles.logo}>MIRROR</Text>}<Text style={styles.headerLabel}>{label ?? "SALON INTELLIGENCE"}</Text><View style={styles.headerBlank} /></View>;
}

export default function TryOnScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { consultation, setConsultation, setPreview, saveLook, removeLook, clearConsultation } = useConsultation();
  const [page, setPage] = useState<Page>(consultation ? "profile" : "home");
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [selected, setSelected] = useState<HairstyleRecommendation | null>(null);
  const [comparison, setComparison] = useState<"before" | "preview">("preview");
  const [step, setStep] = useState(0);
  const [requirementPrompt, setRequirementPrompt] = useState("");
  const [occasion, setOccasion] = useState<Occasion | undefined>();
  const [lengthPreference, setLengthPreference] = useState<LengthPreference | undefined>();
  const [maintenancePreference, setMaintenancePreference] = useState<MaintenancePreference | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [catalogPick, setCatalogPick] = useState<HairstyleRecommendation | null>(null);

  const requestTryOn = useCallback(async (sourceImageUrl: string, mimeType: Portrait["mimeType"], style: HairstyleRecommendation) => {
    const { tryOn } = await postApi<{ tryOn: { previewImageUrl: string } }>("/api/v1/hairstyle/try-ons", {
      sourceImageUrl,
      mimeType,
      style: { id: style.id, name: style.name, prompt: style.prompt },
    });
    return tryOn.previewImageUrl;
  }, []);

  const selectPortrait = useCallback(async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert("Camera access needed", "Please allow camera access to take a clear, front-facing portrait.");
      }
      const options = { allowsEditing: true, aspect: [3, 4] as [number, number], quality: 0.82, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error("The selected image could not be prepared.");
      const mimeType = asset.mimeType === "image/png" || asset.mimeType === "image/webp" ? asset.mimeType : "image/jpeg";
      setPortrait({ uri: asset.uri, base64: asset.base64, mimeType });
      setPage("review");
    } catch (error) {
      Alert.alert("Unable to use this photo", error instanceof Error ? error.message : "Please choose another portrait.");
    }
  }, []);

  const startFlow = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert("Sign in first", "Create a free account or sign in so your looks stay saved.", [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.navigate("/login") },
      ]);
      return;
    }
    clearConsultation();
    setPortrait(null);
    setCatalogPick(null);
    setPage("photo");
  }, [clearConsultation, isAuthenticated]);

  const startFromCatalog = useCallback((style: HairstyleRecommendation) => {
    if (!isAuthenticated) {
      Alert.alert("Sign in first", "Create a free account or sign in so your looks stay saved.", [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.navigate("/login") },
      ]);
      return;
    }
    clearConsultation();
    setPortrait(null);
    setCatalogPick(style);
    setPage("photo");
  }, [clearConsultation, isAuthenticated]);

  const analyzePortrait = useCallback(async () => {
    if (!portrait) return;
    setPage("analyzing"); setStep(0); setIsAnalyzing(true);
    const timer = setInterval(() => setStep((value) => Math.min(value + 1, progress.length - 1)), 900);
    try {
      const { consultation: result } = await postApi<{ consultation: { id: string; sourceImageUrl: string; analysis: import("@/shared/consultation").StyleAnalysis; recommendations: HairstyleRecommendation[] } }>("/api/v1/hairstyle/consultations", { image: { base64: portrait.base64, mimeType: portrait.mimeType }, requirements: { prompt: requirementPrompt.trim() || undefined, occasion, lengthPreference, maintenancePreference } });
      const nextConsultation = { id: result.id, sourceImageUri: portrait.uri, sourceImageUrl: result.sourceImageUrl, analysis: result.analysis, recommendations: result.recommendations, previews: {} };
      setConsultation(nextConsultation);
      Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      // A catalog pick jumps straight to its try-on preview.
      if (catalogPick) {
        const style = result.recommendations.find((item) => item.id === catalogPick.id) ?? catalogPick;
        setSelected(style); setComparison("preview"); setPage("preview"); setIsTryOnLoading(true);
        try {
          const previewImageUrl = await requestTryOn(result.sourceImageUrl, portrait.mimeType, style);
          setPreview(style.id, previewImageUrl);
        } catch (error) {
          Alert.alert("Preview unavailable", error instanceof Error ? error.message : "Please try another style.");
        } finally { setIsTryOnLoading(false); }
        setCatalogPick(null);
        return;
      }

      setPage("profile");
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "PHOTO_RETAKE_REQUIRED") {
        setPage("review");
        Alert.alert("Use a wider portrait", error.message, [{ text: "Retake portrait", onPress: () => setPage("photo") }, { text: "Review photo", style: "cancel" }]);
      } else if (error instanceof ApiClientError && (error.code === "UNAUTHORIZED" || error.code === "RATE_LIMITED")) {
        setPage("requirements");
        if (error.code === "UNAUTHORIZED") router.navigate("/login");
        Alert.alert(error.code === "UNAUTHORIZED" ? "Session expired" : "Daily limit reached", error.message);
      } else {
        setPage("requirements");
        Alert.alert("Analysis paused", error instanceof Error ? error.message : "Please check your connection and try again.");
      }
    } finally { clearInterval(timer); setIsAnalyzing(false); }
  }, [catalogPick, lengthPreference, maintenancePreference, occasion, portrait, requestTryOn, requirementPrompt, setConsultation, setPreview]);

  const makePreview = useCallback(async (style: HairstyleRecommendation) => {
    if (!consultation || !portrait) return;
    setSelected(style); setComparison("preview"); setPage("preview");
    if (consultation.previews[style.id]) return;
    try {
      setIsTryOnLoading(true);
      const previewImageUrl = await requestTryOn(consultation.sourceImageUrl, portrait.mimeType, style);
      setPreview(style.id, previewImageUrl);
      Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "UNAUTHORIZED") router.navigate("/login");
      Alert.alert("Preview unavailable", error instanceof Error ? error.message : "We could not create this hairstyle preview. Please try again.");
    } finally { setIsTryOnLoading(false); }
  }, [consultation, portrait, requestTryOn, setPreview]);

  const saveCurrentLook = useCallback(async () => {
    if (!selected) return;
    try {
      await saveLook(selected);
      Alert.alert("Saved to your edit", "You can compare this look anytime from the Saved tab.");
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again in a moment.");
    }
  }, [saveLook, selected]);

  if (page === "home") return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.home} showsVerticalScrollIndicator={false}><Header /><View style={styles.heroCopy}><Text style={styles.kicker}>YOUR NEXT LOOK, MADE VISIBLE</Text><Text style={styles.heroTitle}>Meet the hair that feels like you.</Text><Text style={styles.body}>Upload one portrait and receive thoughtful style directions plus realistic hairstyle previews made around your original face.</Text></View><View style={styles.heroCard}><View style={styles.aura} /><View style={styles.avatar}><View style={styles.avatarHair} /><View style={styles.avatarFace}><View style={styles.avatarEyes}><View style={styles.dot} /><View style={styles.dot} /></View><View style={styles.avatarMouth} /></View></View><View style={styles.cardCaption}><Text style={styles.captionTitle}>A consultation, not a filter</Text><Text style={styles.captionBody}>Your face stays yours. Only the hairstyle changes.</Text></View></View><View style={styles.steps}>{[["01", "Share a clear portrait", "A front-facing photo works best."], ["02", "See tailored directions", "Get four styles with practical rationale."], ["03", "Try on before you commit", "Compare your original with each look."]].map(([n, title, copy]) => <View key={n} style={styles.stepRow}><Text style={styles.stepNo}>{n}</Text><View><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepCopy}>{copy}</Text></View></View>)}</View><Text style={[styles.kicker, styles.libraryLabel]}>STYLE LIBRARY</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.library}>{styleCatalog.map((style) => <Pressable key={style.id} accessibilityRole="button" onPress={() => startFromCatalog(style)} style={({ pressed }) => [styles.libraryCard, pressed && styles.pressed]}><Text style={styles.libraryName} numberOfLines={1}>{style.name}</Text><Text style={styles.libraryMeta}>{style.maintenance} upkeep · {style.texture}</Text></Pressable>)}</ScrollView><View style={styles.privacy}><Text style={styles.privacyMark}>✦</Text><Text style={styles.privacyText}>Your image is used only to prepare this consultation and preview.</Text></View><Button label="Start my try-on" icon="arrow.right" onPress={startFlow} /></ScrollView></ScreenContainer>;

  if (page === "photo") return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><Header onBack={() => setPage("home")} label="STEP 1 OF 3" /><View style={styles.center}><Text style={styles.kicker}>START WITH A PORTRAIT</Text><Text style={styles.title}>Show us your natural frame.</Text><Text style={styles.body}>Use a recent photo in even light. Keep your face fully visible and avoid hats, sunglasses, or beauty filters.</Text><View style={styles.guide}><View style={styles.guideHead}><View style={styles.guideHair} /><View style={styles.guideFace}><View style={styles.avatarEyes}><View style={styles.dot} /><View style={styles.dot} /></View><View style={styles.avatarMouth} /></View></View><Text style={styles.guideText}>FRONT-FACING · EYE LEVEL · DAYLIGHT</Text></View></View><View style={styles.actions}><Button label="Use photo library" icon="photo" outline onPress={() => selectPortrait(false)} /><Pressable accessibilityRole="button" onPress={() => selectPortrait(true)} style={styles.cameraAction}><IconSymbol name="camera" size={18} color="#211D21" /><Text style={styles.cameraLabel}>Take a new photo</Text></Pressable></View></ScreenContainer>;

  if (page === "review" && portrait) return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><Header onBack={() => setPage("photo")} label="STEP 1 OF 4" /><ScrollView contentContainerStyle={styles.review} showsVerticalScrollIndicator={false}><Text style={styles.kicker}>YOUR PORTRAIT</Text><Text style={styles.title}>A clear view of you.</Text><View style={styles.photoFrame}><Image source={{ uri: portrait.uri }} style={styles.photo} contentFit="contain" /><Pressable onPress={() => setPage("photo")} style={styles.replace}><IconSymbol name="photo" size={15} color="#211D21" /><Text style={styles.replaceText}>Replace</Text></Pressable></View><View style={styles.notice}><Text style={styles.noticeTick}>✓</Text><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>Keep your full hair in frame</Text><Text style={styles.noticeBody}>For the best hairstyle-only preview, use a front-facing portrait that includes the full hairline, crown, and shoulders. If the photo is too close, Mirror will ask for a retake.</Text></View></View></ScrollView><View style={styles.actions}><Button label="Tell us what you want" icon="arrow.right" onPress={() => setPage("requirements")} /></View></ScreenContainer>;

  if (page === "requirements") return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><Header onBack={() => setPage("review")} label="STEP 2 OF 4" /><ScrollView contentContainerStyle={requirementStyles.content} showsVerticalScrollIndicator={false}><Text style={styles.kicker}>YOUR HAIR GOAL</Text><Text style={styles.title}>What kind of look are you after?</Text><Text style={styles.body}>Tell Mirror what you want. Your request guides the recommendations; it never changes your face or identity.</Text><TextInput value={requirementPrompt} onChangeText={setRequirementPrompt} multiline maxLength={500} placeholder="For example: I want a short professional haircut with low maintenance." placeholderTextColor="#9C9193" style={requirementStyles.input} textAlignVertical="top" /><Text style={requirementStyles.sectionLabel}>QUICK START</Text><View style={requirementStyles.chips}>{(["Short hair", "Professional", "Wedding", "Festive", "Face-shape help"] as const).map((label) => <Pressable key={label} onPress={() => { setRequirementPrompt((current) => current ? `${current} ${label}.` : `I want a ${label.toLowerCase()} look.`); if (label === "Wedding") setOccasion("wedding"); if (label === "Festive") setOccasion("festive"); if (label === "Professional") setOccasion("professional"); if (label === "Short hair") setLengthPreference("short"); }} style={requirementStyles.chip}><Text style={requirementStyles.chipText}>{label}</Text></Pressable>)}</View><Text style={requirementStyles.sectionLabel}>OCCASION</Text><View style={requirementStyles.chips}>{(["everyday", "professional", "festive", "wedding"] as Occasion[]).map((value) => <Pressable key={value} onPress={() => setOccasion(value)} style={[requirementStyles.chip, occasion === value && requirementStyles.chipActive]}><Text style={[requirementStyles.chipText, occasion === value && requirementStyles.chipTextActive]}>{value}</Text></Pressable>)}</View><Text style={requirementStyles.sectionLabel}>UPKEEP</Text><View style={requirementStyles.chips}>{(["low", "medium", "high"] as MaintenancePreference[]).map((value) => <Pressable key={value} onPress={() => setMaintenancePreference(value)} style={[requirementStyles.chip, maintenancePreference === value && requirementStyles.chipActive]}><Text style={[requirementStyles.chipText, maintenancePreference === value && requirementStyles.chipTextActive]}>{value} maintenance</Text></Pressable>)}</View></ScrollView><View style={styles.actions}><Button label="Create my consultation" icon="sparkles" onPress={analyzePortrait} /></View></ScreenContainer>;

  if (page === "analyzing") return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><View style={styles.analyzing}><View style={styles.miniPortrait}>{portrait && <Image source={{ uri: portrait.uri }} style={styles.miniImage} contentFit="cover" />}<View style={styles.ring} /></View><Text style={styles.kicker}>BUILDING YOUR PROFILE</Text><Text style={styles.title}>Looking closely, gently.</Text><Text style={styles.body}>We are preparing hairstyle directions based on visual balance, natural movement, and your preferred level of upkeep.</Text><View style={styles.progress}>{progress.map((item, index) => <View key={item} style={[styles.progressBar, index <= step && styles.progressActive]} />)}</View><View style={styles.status}><ActivityIndicator size="small" color="#7A3E62" /><Text style={styles.statusText}>{progress[step]}</Text></View></View></ScreenContainer>;

  if (page === "profile" && consultation) return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.profile} showsVerticalScrollIndicator={false}><Header onBack={() => { clearConsultation(); setSelected(null); setPortrait(null); setPage("photo"); }} label="YOUR STYLE PROFILE" /><Text style={styles.kicker}>VISUAL STYLE NOTES</Text><Text style={styles.profileTitle}>{consultation.analysis.faceShape}</Text><Text style={styles.body}>{consultation.analysis.overview}</Text><View style={styles.insight}><Text style={styles.cardEyebrow}>WHAT WE NOTICED</Text>{consultation.analysis.featureNotes.map((note) => <View key={note} style={styles.note}><View style={styles.bullet} /><Text style={styles.noteText}>{note}</Text></View>)}</View><View style={styles.principles}><Text style={styles.cardEyebrow}>YOUR STYLE PRINCIPLES</Text>{consultation.analysis.stylePrinciples.map((item, index) => <View key={item} style={styles.principle}><Text style={styles.principleNo}>0{index + 1}</Text><Text style={styles.principleText}>{item}</Text></View>)}</View><View style={styles.disclaimer}><Text style={styles.disclaimerText}>{consultation.analysis.confidenceNote}</Text></View></ScrollView><View style={styles.actions}><Button label="View my recommendations" icon="arrow.right" onPress={() => setPage("styles")} /></View></ScreenContainer>;

  if (page === "styles" && consultation) return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><Header onBack={() => setPage("profile")} label="YOUR EDIT" /><View style={styles.styleIntro}><Text style={styles.kicker}>FOUR DIRECTIONS</Text><Text style={styles.title}>Start with what feels like you.</Text><Text style={styles.body}>Tap a look to create a hairstyle-only preview around your original image.</Text></View><FlatList data={consultation.recommendations} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} renderItem={({ item, index }) => <Pressable accessibilityRole="button" onPress={() => makePreview(item)} style={({ pressed }) => [styles.styleCard, pressed && styles.pressed]}><View style={[styles.swatch, { backgroundColor: ["#D6A9AE", "#A77A62", "#5F4039", "#BF935D"][index] }]}><Text style={styles.rank}>0{index + 1}</Text><View style={styles.styleIllustration}><View style={styles.styleHair} /><View style={styles.styleFace} /></View></View><View style={styles.styleCopy}><View style={styles.styleTitleRow}><Text style={styles.styleName}>{item.name}</Text><IconSymbol name="arrow.right" size={18} color="#7A3E62" /></View><Text style={styles.styleDescription}>{item.description}</Text><View style={styles.tags}><Text style={styles.tag}>{item.maintenance} upkeep</Text><Text style={styles.texture}>{item.texture}</Text></View></View></Pressable>} /></ScreenContainer>;

  if (page === "preview" && consultation && selected && portrait) {
    const generated = consultation.previews[selected.id];
    return <ScreenContainer className="px-5" edges={["top", "left", "right"]}><ScrollView contentContainerStyle={previewStyles.content} showsVerticalScrollIndicator={false}><Header onBack={() => setPage("styles")} label="VIRTUAL TRY-ON" /><View style={styles.previewIntro}><Text style={styles.kicker}>THE {selected.name.toUpperCase()}</Text><Text style={styles.previewTitle}>{generated ? "A style, still unmistakably you." : "Creating your preview."}</Text></View><View style={styles.previewFrame}>{isTryOnLoading ? <View style={styles.loading}><ActivityIndicator size="large" color="#7A3E62" /><Text style={styles.loadingTitle}>Styling only the hair</Text><Text style={styles.loadingBody}>This can take a little time. We keep the original face and every non-hair detail protected in the request.</Text></View> : <Image source={{ uri: comparison === "preview" && generated ? generated : portrait.uri }} style={styles.previewImage} contentFit="contain" />}</View>{generated && <View style={styles.toggle}><Pressable onPress={() => setComparison("before")} style={[styles.toggleOption, comparison === "before" && styles.toggleOn]}><Text style={[styles.toggleText, comparison === "before" && styles.toggleTextOn]}>Before</Text></Pressable><Pressable onPress={() => setComparison("preview")} style={[styles.toggleOption, comparison === "preview" && styles.toggleOn]}><Text style={[styles.toggleText, comparison === "preview" && styles.toggleTextOn]}>Preview</Text></Pressable></View>}<View style={styles.previewCopy}><Text style={styles.previewStyle}>{selected.name}</Text><Text style={styles.previewBody}>{selected.whyItWorks}</Text></View>{generated && <View style={styles.actions}><Button label="Save this look" icon="bookmark.fill" onPress={saveCurrentLook} /></View>}</ScrollView></ScreenContainer>;
  }
  return null;
}

const styles = StyleSheet.create({
  home: { paddingTop: 16, paddingBottom: 30, gap: 25 }, header: { height: 47, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, logo: { color: "#211D21", fontSize: 15, letterSpacing: 2.3, fontWeight: "800" }, headerLabel: { color: "#8E8587", fontSize: 9, letterSpacing: 1.1, fontWeight: "800" }, headerBlank: { width: 38 }, back: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "#E9DCE0", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, kicker: { color: "#7A3E62", fontSize: 10, lineHeight: 15, letterSpacing: 1.3, fontWeight: "800" }, heroCopy: { gap: 10, marginTop: 14 }, heroTitle: { color: "#211D21", fontSize: 42, lineHeight: 47, letterSpacing: -1.35, fontWeight: "700" }, title: { color: "#211D21", fontSize: 32, lineHeight: 38, letterSpacing: -0.8, fontWeight: "700", marginTop: 9 }, body: { color: "#665D60", fontSize: 15, lineHeight: 23, marginTop: 10 },
  libraryLabel: { marginTop: 4 }, library: { gap: 9, paddingRight: 20 }, libraryCard: { borderWidth: 1, borderColor: "#E4D4D9", backgroundColor: "#FFFFFF", borderRadius: 15, paddingHorizontal: 13, paddingVertical: 11, maxWidth: 220 }, libraryName: { color: "#211D21", fontSize: 13, fontWeight: "800" }, libraryMeta: { color: "#8E8587", fontSize: 10, fontWeight: "600", marginTop: 3 }, heroCard: { height: 299, borderRadius: 28, backgroundColor: "#F1DDE4", overflow: "hidden", alignItems: "center", justifyContent: "flex-end" }, aura: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#E2BFCB", top: -165 }, avatar: { height: 202, width: 160, alignItems: "center", position: "relative", marginBottom: 45 }, avatarHair: { width: 158, height: 193, borderTopLeftRadius: 78, borderTopRightRadius: 78, borderBottomLeftRadius: 48, borderBottomRightRadius: 48, backgroundColor: "#3B2829", position: "absolute" }, avatarFace: { marginTop: 26, width: 108, height: 147, borderRadius: 56, backgroundColor: "#D9A790", alignItems: "center", paddingTop: 51, zIndex: 1 }, avatarEyes: { flexDirection: "row", gap: 26 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#392729" }, avatarMouth: { marginTop: 22, width: 22, height: 4, borderRadius: 4, backgroundColor: "#A4525C" }, cardCaption: { position: "absolute", left: 16, right: 16, bottom: 16, padding: 13, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.86)", gap: 3 }, captionTitle: { color: "#211D21", fontSize: 14, fontWeight: "800" }, captionBody: { color: "#665D60", fontSize: 12, lineHeight: 17 }, steps: { gap: 17 }, stepRow: { flexDirection: "row", gap: 13 }, stepNo: { color: "#7A3E62", backgroundColor: "#F2E6E8", borderRadius: 13, width: 31, height: 25, textAlign: "center", textAlignVertical: "center", fontSize: 10, fontWeight: "800" }, stepTitle: { color: "#211D21", fontSize: 15, lineHeight: 20, fontWeight: "800" }, stepCopy: { color: "#8E8587", fontSize: 13, lineHeight: 19, marginTop: 1 }, privacy: { flexDirection: "row", gap: 10, alignItems: "center", paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E9DCE0" }, privacyMark: { color: "#5F7E70", fontSize: 15 }, privacyText: { flex: 1, color: "#777073", fontSize: 12, lineHeight: 17 }, button: { height: 56, borderRadius: 18, backgroundColor: "#7A3E62", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, buttonLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, outlineButton: { height: 55, borderRadius: 18, borderWidth: 1.5, borderColor: "#7A3E62", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, outlineLabel: { color: "#7A3E62", fontSize: 16, fontWeight: "800" }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] }, center: { flex: 1, alignItems: "center", paddingTop: 35 }, guide: { width: "100%", height: 285, marginTop: 30, borderRadius: 28, backgroundColor: "#F2E5E5", borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C99DA9", alignItems: "center", justifyContent: "center", gap: 17 }, guideHead: { width: 116, height: 156, alignItems: "center", position: "relative" }, guideHair: { width: 116, height: 145, borderTopLeftRadius: 58, borderTopRightRadius: 58, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, backgroundColor: "#C99DA9", position: "absolute" }, guideFace: { width: 76, height: 110, borderRadius: 40, marginTop: 22, backgroundColor: "#E8C7BB", zIndex: 1, alignItems: "center", paddingTop: 38 }, guideText: { color: "#7A3E62", fontSize: 9, letterSpacing: 1, fontWeight: "800" }, actions: { paddingBottom: 18, paddingTop: 12, gap: 10 }, cameraAction: { height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, cameraLabel: { color: "#211D21", fontSize: 14, fontWeight: "800" }, review: { paddingTop: 27, gap: 21 }, photoFrame: { height: 374, borderRadius: 28, overflow: "hidden", backgroundColor: "#E7D4D7", position: "relative" }, photo: { width: "100%", height: "100%" }, replace: { position: "absolute", top: 13, right: 13, backgroundColor: "rgba(255,255,255,0.92)", height: 35, paddingHorizontal: 12, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6 }, replaceText: { color: "#211D21", fontSize: 12, fontWeight: "800" }, notice: { flexDirection: "row", padding: 16, gap: 11, borderWidth: 1, borderColor: "#E9DCE0", borderRadius: 18, backgroundColor: "#FFFFFF" }, noticeTick: { color: "#5F7E70", fontSize: 16, fontWeight: "800" }, noticeCopy: { flex: 1, gap: 3 }, noticeTitle: { color: "#211D21", fontSize: 14, fontWeight: "800" }, noticeBody: { color: "#777073", fontSize: 12, lineHeight: 17 }, analyzing: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 80 }, miniPortrait: { width: 132, height: 132, borderRadius: 66, marginBottom: 32 }, miniImage: { width: "100%", height: "100%", borderRadius: 66 }, ring: { position: "absolute", width: 154, height: 154, borderRadius: 77, borderWidth: 2, borderColor: "#7A3E62", borderTopColor: "#E2BFCB", top: -11, left: -11 }, progress: { width: "100%", flexDirection: "row", gap: 6, marginTop: 38 }, progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E9DCE0" }, progressActive: { backgroundColor: "#7A3E62" }, status: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 9 }, statusText: { color: "#7A3E62", fontSize: 13, fontWeight: "800" }, profile: { paddingTop: 8, paddingBottom: 25, gap: 21 }, profileTitle: { color: "#211D21", fontSize: 37, lineHeight: 43, letterSpacing: -1, fontWeight: "700", marginTop: 2 }, insight: { backgroundColor: "#F2E5E5", borderRadius: 22, padding: 19, gap: 13 }, cardEyebrow: { color: "#7A3E62", fontSize: 10, letterSpacing: 1.2, fontWeight: "800" }, note: { flexDirection: "row", gap: 9 }, bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#C97A78", marginTop: 6 }, noteText: { flex: 1, color: "#4B4144", fontSize: 14, lineHeight: 20 }, principles: { gap: 13 }, principle: { flexDirection: "row", gap: 13, borderBottomWidth: 1, borderBottomColor: "#E9DCE0", paddingBottom: 13 }, principleNo: { color: "#C97A78", fontSize: 12, fontWeight: "800" }, principleText: { flex: 1, color: "#3D3537", fontSize: 14, lineHeight: 20 }, disclaimer: { padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9DCE0" }, disclaimerText: { color: "#777073", fontSize: 12, lineHeight: 18, fontStyle: "italic" }, styleIntro: { paddingTop: 17, paddingBottom: 16 }, list: { gap: 13, paddingBottom: 20 }, styleCard: { flexDirection: "row", minHeight: 148, borderRadius: 22, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9DCE0" }, swatch: { width: 106, alignItems: "center", justifyContent: "center", position: "relative" }, rank: { position: "absolute", left: 12, top: 12, color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "800" }, styleIllustration: { width: 56, height: 73, alignItems: "center", justifyContent: "flex-end" }, styleHair: { position: "absolute", width: 57, height: 67, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, backgroundColor: "rgba(45,31,32,0.72)" }, styleFace: { width: 36, height: 48, borderRadius: 20, marginBottom: 3, backgroundColor: "#E7C2B6", zIndex: 1 }, styleCopy: { flex: 1, padding: 15, justifyContent: "space-between", gap: 6 }, styleTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 7 }, styleName: { flex: 1, color: "#211D21", fontSize: 16, lineHeight: 20, fontWeight: "800" }, styleDescription: { color: "#777073", fontSize: 12, lineHeight: 17 }, tags: { flexDirection: "row", gap: 8, alignItems: "center" }, tag: { color: "#7A3E62", fontSize: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: "hidden", backgroundColor: "#F3E4E9", fontWeight: "800" }, texture: { color: "#8E8587", fontSize: 10, fontWeight: "700" }, previewIntro: { paddingTop: 17, paddingBottom: 16, gap: 3 }, previewTitle: { color: "#211D21", fontSize: 27, lineHeight: 33, letterSpacing: -0.7, fontWeight: "700" }, previewFrame: { height: 376, backgroundColor: "#E7D4D7", borderRadius: 27, overflow: "hidden" }, previewImage: { width: "100%", height: "100%" }, loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 46, gap: 11 }, loadingTitle: { color: "#211D21", fontSize: 17, fontWeight: "800", marginTop: 6 }, loadingBody: { color: "#777073", fontSize: 13, lineHeight: 19, textAlign: "center" }, toggle: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: "#F0E6E7", marginTop: 14 }, toggleOption: { flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }, toggleOn: { backgroundColor: "#FFFFFF" }, toggleText: { color: "#8E8587", fontSize: 13, fontWeight: "800" }, toggleTextOn: { color: "#211D21" }, previewCopy: { paddingTop: 17, gap: 4 }, previewStyle: { color: "#211D21", fontSize: 17, fontWeight: "800" }, previewBody: { color: "#665D60", fontSize: 13, lineHeight: 19 },
});

const requirementStyles = StyleSheet.create({
  content: { paddingTop: 27, paddingBottom: 24, gap: 13 },
  input: { minHeight: 128, marginTop: 8, borderRadius: 18, borderWidth: 1, borderColor: "#E9DCE0", backgroundColor: "#FFFFFF", padding: 15, color: "#211D21", fontSize: 15, lineHeight: 22 },
  sectionLabel: { color: "#7A3E62", fontSize: 10, letterSpacing: 1.2, fontWeight: "800", marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 15, borderWidth: 1, borderColor: "#E4D4D9", backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: "#7A3E62", borderColor: "#7A3E62" },
  chipText: { color: "#554B4E", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  chipTextActive: { color: "#FFFFFF" },
});

const previewStyles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 28 },
});
