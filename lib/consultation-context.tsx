import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { HairstyleRecommendation, StyleAnalysis } from "@/shared/consultation";

export type ConsultationState = {
  sourceImageUri: string;
  sourceImageUrl: string;
  analysis: StyleAnalysis;
  recommendations: HairstyleRecommendation[];
  previews: Record<string, string>;
};

export type SavedLook = {
  id: string;
  savedAt: string;
  sourceImageUri: string;
  previewImageUrl: string;
  recommendation: HairstyleRecommendation;
};

type ConsultationContextValue = {
  consultation: ConsultationState | null;
  savedLooks: SavedLook[];
  setConsultation: (consultation: ConsultationState) => void;
  setPreview: (recommendationId: string, previewImageUrl: string) => void;
  saveLook: (recommendation: HairstyleRecommendation) => void;
  clearConsultation: () => void;
};

const ConsultationContext = createContext<ConsultationContextValue | null>(null);

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [consultation, setConsultation] = useState<ConsultationState | null>(null);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const value = useMemo<ConsultationContextValue>(() => ({
    consultation,
    savedLooks,
    setConsultation,
    setPreview: (recommendationId, previewImageUrl) => setConsultation((current) => current ? { ...current, previews: { ...current.previews, [recommendationId]: previewImageUrl } } : current),
    saveLook: (recommendation) => setConsultation((current) => {
      if (!current) return current;
      const previewImageUrl = current.previews[recommendation.id];
      if (!previewImageUrl) return current;
      setSavedLooks((looks) => looks.some((look) => look.recommendation.id === recommendation.id && look.previewImageUrl === previewImageUrl) ? looks : [{ id: `${recommendation.id}-${Date.now()}`, savedAt: new Date().toISOString(), sourceImageUri: current.sourceImageUri, previewImageUrl, recommendation }, ...looks]);
      return current;
    }),
    clearConsultation: () => setConsultation(null),
  }), [consultation, savedLooks]);
  return <ConsultationContext.Provider value={value}>{children}</ConsultationContext.Provider>;
}

export function useConsultation() {
  const context = useContext(ConsultationContext);
  if (!context) throw new Error("useConsultation must be used within ConsultationProvider");
  return context;
}

