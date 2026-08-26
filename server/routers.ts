import { COOKIE_NAME } from "../shared/const.js";
import { fallbackRecommendations, fallbackStyleAnalysis, parseStyleAnalysis } from "../shared/consultation";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

const imageMimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

function toAbsoluteStorageUrl(req: any, path: string) {
  if (path.startsWith("http")) return path;
  const forwardedProtocol = typeof req.headers?.["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"].split(",")[0] : undefined;
  const forwardedHost = typeof req.headers?.["x-forwarded-host"] === "string" ? req.headers["x-forwarded-host"].split(",")[0] : undefined;
  const protocol = forwardedProtocol ?? req.protocol ?? "https";
  const host = forwardedHost ?? req.get?.("host");
  if (!host) throw new Error("Unable to construct a secure image URL.");
  return `${protocol}://${host}${path}`;
}

function normalizeBase64(value: string) {
  const dataUrlMatch = value.match(/^data:[^;]+;base64,(.*)$/s);
  return dataUrlMatch?.[1] ?? value;
}

const analysisPrompt = `You are a respectful salon consultation assistant. Analyze only the visible hairstyle framing and general face silhouette in the customer-provided portrait. Do not infer, mention, or judge race, ethnicity, nationality, religion, age, gender identity, sexual orientation, health, disability, personality, or attractiveness. Do not make medical claims. Do not identify the person.

Offer visual hairstyle inspiration, not a guarantee. You may discuss apparent face-shape silhouette and visible proportions in neutral aesthetic terms. Avoid absolute judgments. Return valid JSON only in this exact shape:
{
  "analysis": {
    "faceShape": "short neutral descriptor",
    "overview": "two concise sentences",
    "featureNotes": ["three neutral visible framing observations"],
    "stylePrinciples": ["three practical, inclusive styling principles"],
    "confidenceNote": "one sentence explaining that results are visual guidance from a single portrait"
  },
  "recommendations": [
    {
      "id": "lowercase-kebab-case",
      "name": "style name",
      "description": "concise visual description",
      "whyItWorks": "neutral explanation",
      "maintenance": "Low, Medium, or High",
      "texture": "short texture tag",
      "tone": "short style mood tag",
      "prompt": "a precise hairstyle-only edit instruction"
    }
  ]
}

Recommend exactly four varied styles. The prompt must describe only the requested hairstyle; it must not ask to change facial features, skin, identity, body, clothing, lighting, or background.`;

const tryOnGuardrails = `Preserve the person in the reference image exactly: their original face, identity, facial features, skin tone and texture, expression, apparent age, body, clothing, pose, image crop, background, lighting, camera angle, and image realism. Change only the hairstyle. Do not beautify, reshape, smooth, age, de-age, recolor skin, add accessories, alter makeup, or edit any part of the face. The output must be a realistic salon hairstyle visualization with natural strands and clean boundaries around the hairline.`;

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  consultation: router({
    analyze: publicProcedure
      .input(z.object({ imageBase64: z.string().min(100).max(14_000_000), mimeType: imageMimeTypeSchema }))
      .mutation(async ({ ctx, input }) => {
        const imageBuffer = Buffer.from(normalizeBase64(input.imageBase64), "base64");
        if (imageBuffer.length < 100 || imageBuffer.length > 10_000_000) {
          throw new Error("Please choose a portrait image smaller than 10 MB.");
        }
        const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const { url } = await storagePut(`consultations/${crypto.randomUUID()}.${extension}`, imageBuffer, input.mimeType);
        const sourceImageUrl = toAbsoluteStorageUrl(ctx.req, url);
        try {
          const response = await invokeLLM({
            model: "gemini-3-flash-preview",
            messages: [
              { role: "system", content: analysisPrompt },
              { role: "user", content: [{ type: "text", text: "Create a considerate, practical hairstyle consultation for this portrait." }, { type: "image_url", image_url: { url: sourceImageUrl, detail: "high" } }] },
            ],
            response_format: { type: "json_object" },
          });
          const content = response.choices[0]?.message?.content;
          if (typeof content !== "string") throw new Error("The analysis did not return a usable response.");
          return { sourceImageUrl, ...parseStyleAnalysis(content) };
        } catch (error) {
          console.warn("[consultation] analysis fallback", error instanceof Error ? error.message : "unknown error");
          return { sourceImageUrl, analysis: fallbackStyleAnalysis, recommendations: fallbackRecommendations };
        }
      }),
    tryOn: publicProcedure
      .input(z.object({ sourceImageUrl: z.string().url(), mimeType: imageMimeTypeSchema, styleName: z.string().min(2).max(80), stylePrompt: z.string().min(10).max(900) }))
      .mutation(async ({ ctx, input }) => {
        const { url } = await generateImage({
          prompt: `Create a realistic virtual hairstyle try-on. Requested style: ${input.styleName}. ${input.stylePrompt}\n\n${tryOnGuardrails}`,
          originalImages: [{ url: input.sourceImageUrl, mimeType: input.mimeType }],
          quality: "medium",
        });
        if (!url) throw new Error("The virtual try-on did not return an image.");
        return { previewImageUrl: toAbsoluteStorageUrl(ctx.req, url) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
