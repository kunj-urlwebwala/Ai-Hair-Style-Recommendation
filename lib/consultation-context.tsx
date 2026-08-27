import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiCall } from "@/lib/_core/api";
import type {
  HairstyleRecommendation,
  StyleAnalysis,
} from "@/shared/consultation";

export type ConsultationState = {
  id: string;
  sourceImageUri: string;
  sourceImageUrl: string;
  analysis: StyleAnalysis;
  recommendations: HairstyleRecommendation[];
  previews: Record<string, string>;
};

export type SavedLook = {
  id: string;
  consultationId: string;
  recommendation: HairstyleRecommendation;
  previewImageUrl: string;
  createdAt: string;
};

type ConsultationContextValue = {
  consultation: ConsultationState | null;
  savedLooks: SavedLook[];
  setConsultation: (consultation: ConsultationState) => void;
  setPreview: (recommendationId: string, previewImageUrl: string) => void;
  saveLook: (recommendation: HairstyleRecommendation) => Promise<void>;
  removeLook: (lookId: string) => Promise<void>;
  clearConsultation: () => void;
};

const ConsultationContext = createContext<ConsultationContextValue | null>(
  null,
);

export function ConsultationProvider({ children }: { children: ReactNode }) {
  const [consultation, setConsultation] = useState<ConsultationState | null>(
    null,
  );
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);

  // Load the persisted shortlist.
  useEffect(() => {
    let cancelled = false;
    apiCall<{ data: { looks: SavedLook[] } }>("/api/v1/hairstyle/saved-looks")
      .then(({ data }) => {
        if (!cancelled && data?.looks) setSavedLooks(data.looks);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveLook = useCallback(
    async (recommendation: HairstyleRecommendation) => {
      if (!consultation) throw new Error("No active consultation");
      const previewImageUrl = consultation.previews[recommendation.id];
      if (!previewImageUrl)
        throw new Error("Generate the preview before saving this look");

      const { data } = await apiCall<{ data: { look: SavedLook } }>(
        "/api/v1/hairstyle/saved-looks",
        {
          method: "POST",
          body: JSON.stringify({
            consultationId: consultation.id,
            recommendation,
            previewImageUrl,
          }),
        },
      );

      const look = data?.look;
      if (look)
        setSavedLooks((current) => [
          look,
          ...current.filter((item) => item.id !== look.id),
        ]);
    },
    [consultation],
  );

  const removeLook = useCallback(async (lookId: string) => {
    await apiCall<{ success: boolean }>(
      `/api/v1/hairstyle/saved-looks/${encodeURIComponent(lookId)}`,
      {
        method: "DELETE",
      },
    );
    setSavedLooks((current) => current.filter((look) => look.id !== lookId));
  }, []);

  const value = useMemo<ConsultationContextValue>(
    () => ({
      consultation,
      savedLooks,
      setConsultation,
      setPreview: (recommendationId, previewImageUrl) =>
        setConsultation((current) =>
          current
            ? {
                ...current,
                previews: {
                  ...current.previews,
                  [recommendationId]: previewImageUrl,
                },
              }
            : current,
        ),
      saveLook,
      removeLook,
      clearConsultation: () => setConsultation(null),
    }),
    [consultation, savedLooks, saveLook, removeLook],
  );

  return (
    <ConsultationContext.Provider value={value}>
      {children}
    </ConsultationContext.Provider>
  );
}

export function useConsultation() {
  const context = useContext(ConsultationContext);
  if (!context)
    throw new Error("useConsultation must be used within ConsultationProvider");
  return context;
}
