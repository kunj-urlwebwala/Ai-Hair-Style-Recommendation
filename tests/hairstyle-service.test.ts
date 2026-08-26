import { describe, expect, it } from "vitest";

import { createTryOn, customerRequirementsSchema } from "../server/hairstyle-service";

describe("hairstyle service API contract", () => {
  it("normalizes valid Indian salon preference cues", () => {
    const requirements = customerRequirementsSchema.parse({
      prompt: "I want a polished wedding look with natural texture.",
      occasion: "wedding",
      lengthPreference: "long",
      maintenancePreference: "medium",
    });

    expect(requirements.occasion).toBe("wedding");
    expect(requirements.lengthPreference).toBe("long");
    expect(requirements.prompt).toContain("wedding");
  });

  it("rejects a try-on source that was not created by the consultation API", async () => {
    await expect(createTryOn({
      sourceImageUrl: "https://untrusted.example.com/portrait.jpg",
      mimeType: "image/jpeg",
      style: { name: "Soft layered lob", prompt: "Create a collarbone-length lob with soft natural movement." },
      publicOrigin: "https://api.mirror.example.com",
    })).rejects.toMatchObject({ code: "INVALID_SOURCE_IMAGE", status: 400 });
  });
});
