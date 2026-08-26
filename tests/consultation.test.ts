import { describe, expect, it } from "vitest";
import { fallbackRecommendations, parseStyleAnalysis } from "../shared/consultation";

describe("consultation response parsing", () => {
  it("normalizes a valid structured hairstyle consultation", () => {
    const result = parseStyleAnalysis(JSON.stringify({
      analysis: { faceShape: "Soft oval silhouette", overview: "A balanced visual frame.", featureNotes: ["Note one", "Note two", "Note three"], stylePrinciples: ["Principle one", "Principle two", "Principle three"], confidenceNote: "A one-photo visual guide." },
      recommendations: [{ ...fallbackRecommendations[0], id: "warm-lob", maintenance: "Low" }, fallbackRecommendations[1], fallbackRecommendations[2], fallbackRecommendations[3]],
    }));
    expect(result.analysis.faceShape).toBe("Soft oval silhouette");
    expect(result.recommendations).toHaveLength(4);
    expect(result.recommendations[0].maintenance).toBe("Low");
  });

  it("uses curated styles when the generated payload is incomplete", () => {
    const result = parseStyleAnalysis(JSON.stringify({ analysis: {}, recommendations: [] }));
    expect(result.recommendations).toEqual(fallbackRecommendations);
    expect(result.analysis.faceShape).toBe("Style profile ready");
  });
});
