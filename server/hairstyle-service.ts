import { z } from "zod";

import { parseStyleAnalysis } from "../shared/consultation";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export const imageMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
export type ImageMimeType = z.infer<typeof imageMimeTypeSchema>;

export const customerRequirementsSchema = z.object({
  prompt: z.string().trim().min(2).max(500).optional(),
  occasion: z.enum(["everyday", "professional", "festive", "wedding", "other"]).optional(),
  lengthPreference: z.enum(["short", "medium", "long", "open"]).optional(),
  maintenancePreference: z.enum(["low", "medium", "high", "open"]).optional(),
}).default({});
export type CustomerRequirements = z.infer<typeof customerRequirementsSchema>;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type AnalyzeInput = {
  imageBase64: string;
  mimeType: ImageMimeType;
  requirements?: CustomerRequirements;
  publicOrigin: string;
};

type TryOnInput = {
  sourceImageUrl: string;
  mimeType: ImageMimeType;
  style: { id?: string; name: string; prompt: string };
  publicOrigin: string;
};

function normalizedBase64(value: string) {
  const match = value.match(/^data:[^;]+;base64,(.*)$/s);
  return match?.[1] ?? value;
}

function storageUrl(publicOrigin: string, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${publicOrigin.replace(/\/$/, "")}${path}`;
}

function extensionFor(mimeType: ImageMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function requirementContext(requirements: CustomerRequirements) {
  const values = [
    requirements.prompt ? `Customer request: ${requirements.prompt}` : "Customer request: not specified.",
    requirements.occasion ? `Occasion: ${requirements.occasion}.` : null,
    requirements.lengthPreference ? `Length preference: ${requirements.lengthPreference}.` : null,
    requirements.maintenancePreference ? `Maintenance preference: ${requirements.maintenancePreference}.` : null,
  ].filter(Boolean);
  return values.join(" ");
}

const analysisSystemPrompt = `You are Mirror, a respectful salon consultation assistant for an India-focused hairstyle MVP. Offer modern and traditional Indian salon context only when it is relevant to the customer's stated request or occasion. Do not infer nationality, ethnicity, caste, religion, region, gender identity, age, health, disability, personality, attractiveness, or socioeconomic status from a portrait. Do not identify the person.

Analyze only visible hairstyle framing, hair texture, hair density where visually clear, and neutral face silhouette. Make no medical claims. Recommendations are visual guidance from a single portrait, not a guarantee. Preserve natural texture credibility and avoid homogenizing hair.

When an explicitly stated wedding or festive requirement is present, styles may be appropriate for Indian salon occasions, such as polished buns, braids, soft waves, or neat groomed cuts. Do not add jewellery, flowers, makeup, garments, or any non-hair accessory in a virtual try-on instruction.

Return valid JSON only with this shape:
{
  "analysis": {
    "faceShape": "short neutral descriptor",
    "overview": "two concise sentences",
    "featureNotes": ["three neutral visual observations"],
    "stylePrinciples": ["three practical principles"],
    "confidenceNote": "one sentence that describes this as visual guidance from one portrait"
  },
  "recommendations": [
    {
      "id": "lowercase-kebab-case",
      "name": "style name",
      "description": "concise visual description",
      "whyItWorks": "neutral explanation tied to request and visible framing",
      "maintenance": "Low, Medium, or High",
      "texture": "short texture tag",
      "tone": "short mood or occasion tag",
      "prompt": "specific hairstyle-only edit instruction"
    }
  ]
}

Provide exactly four varied recommendations. The edit prompt must describe hair only and must never request changes to face, identity, skin, facial hair, body, clothing, pose, lighting, crop, or background.`;

const tryOnPreservationGuardrails = `Edit the reference portrait with extreme restraint. Preserve the person's original face, identity, facial structure, skin tone and texture, eyes, nose, lips, beard or facial hair, expression, apparent age, body, clothing, pose, crop, background, lighting, camera angle, and image realism. Change only scalp hair and hairstyle. Do not beautify, smooth skin, reshape any face feature, alter beard, add hair accessories, add jewellery, alter makeup, recolor skin, alter clothing, or add non-hair objects. Keep the hairline believable and natural, retain credible texture, and create a realistic salon preview.`;

function ensureInternalStoredPortrait(sourceImageUrl: string, publicOrigin: string) {
  const parsed = new URL(sourceImageUrl);
  const publicUrl = new URL(publicOrigin);
  if (parsed.origin !== publicUrl.origin || !parsed.pathname.startsWith("/manus-storage/consultations/")) {
    throw new ApiError(400, "INVALID_SOURCE_IMAGE", "The source image must be a portrait returned by the consultation API.");
  }
}

export async function createConsultation(input: AnalyzeInput) {
  const requirements = customerRequirementsSchema.parse(input.requirements ?? {});
  const imageBuffer = Buffer.from(normalizedBase64(input.imageBase64), "base64");
  if (imageBuffer.length < 100 || imageBuffer.length > 10_000_000) {
    throw new ApiError(400, "INVALID_IMAGE", "Please provide a JPEG, PNG, or WebP portrait smaller than 10 MB.");
  }

  const consultationId = `con_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const { url } = await storagePut(`consultations/${consultationId}.${extensionFor(input.mimeType)}`, imageBuffer, input.mimeType);
  const sourceImageUrl = storageUrl(input.publicOrigin, url);

  try {
    const response = await invokeLLM({
      model: "gemini-3-flash-preview",
      messages: [
        { role: "system", content: analysisSystemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Create an inclusive, practical hairstyle consultation. ${requirementContext(requirements)}` },
            { type: "image_url", image_url: { url: sourceImageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") throw new Error("No usable analysis content was returned.");
    const parsed = parseStyleAnalysis(content);
    return { id: consultationId, sourceImageUrl, requirements, ...parsed };
  } catch (error) {
    console.error("[hairstyle-service] analysis provider failed", error instanceof Error ? error.message : "unknown error");
    throw new ApiError(502, "AI_PROVIDER_ERROR", "The hairstyle analysis provider could not produce a consultation. Please try again.");
  }
}

export async function createTryOn(input: TryOnInput) {
  ensureInternalStoredPortrait(input.sourceImageUrl, input.publicOrigin);
  if (input.style.name.trim().length < 2 || input.style.name.length > 80 || input.style.prompt.trim().length < 10 || input.style.prompt.length > 900) {
    throw new ApiError(400, "VALIDATION_ERROR", "Please provide a valid selected hairstyle.");
  }

  try {
    const result = await generateImage({
      prompt: `Create a realistic virtual hairstyle try-on. Requested hairstyle: ${input.style.name}. Hairstyle description: ${input.style.prompt}\n\n${tryOnPreservationGuardrails}`,
      originalImages: [{ url: input.sourceImageUrl, mimeType: input.mimeType }],
      quality: "high",
    });
    if (!result.url) throw new Error("The image provider returned no preview URL.");
    return {
      id: `try_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      previewImageUrl: storageUrl(input.publicOrigin, result.url),
      preservation: {
        target: "hairstyle_only",
        note: "The generator was instructed to preserve identity and every non-hair feature. Results remain best-effort visual guidance.",
      },
    };
  } catch (error) {
    console.error("[hairstyle-service] image provider failed", error instanceof Error ? error.message : "unknown error");
    throw new ApiError(502, "AI_PROVIDER_ERROR", "The virtual try-on provider could not create a preview. Please try again.");
  }
}
