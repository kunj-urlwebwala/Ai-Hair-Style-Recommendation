import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import {
  ApiError,
  createConsultation,
  createTryOn,
  customerRequirementsSchema,
  imageMimeTypeSchema,
} from "../hairstyle-service";

const consultationRequestSchema = z.object({
  image: z.object({
    base64: z.string().min(100).max(14_000_000),
    mimeType: imageMimeTypeSchema,
  }),
  requirements: customerRequirementsSchema.optional(),
});

const tryOnRequestSchema = z.object({
  sourceImageUrl: z.string().url(),
  mimeType: imageMimeTypeSchema,
  style: z.object({
    id: z.string().trim().max(100).optional(),
    name: z.string().trim().min(2).max(80),
    prompt: z.string().trim().min(10).max(900),
  }),
});

function requestId(req: Request) {
  return (req.headers["x-request-id"] as string | undefined) ?? `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function publicOrigin(req: Request) {
  const forwardedProtocol = req.header("x-forwarded-proto")?.split(",")[0];
  const forwardedHost = req.header("x-forwarded-host")?.split(",")[0];
  const protocol = forwardedProtocol ?? req.protocol ?? "https";
  const host = forwardedHost ?? req.get("host");
  if (!host) throw new ApiError(500, "INTERNAL_ERROR", "Unable to resolve the API public origin.");
  return `${protocol}://${host}`;
}

function sendError(res: Response, id: string, error: unknown) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request body is invalid.", details: error.flatten(), requestId: id } });
  }
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: id } });
  }
  console.error("[v1-hairstyle-router] unhandled error", error);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred.", requestId: id } });
}

export function createV1HairstyleRouter() {
  const router = Router();

  router.use((req, res, next) => {
    const id = requestId(req);
    res.locals.requestId = id;
    res.header("X-Request-Id", id);
    next();
  });

  router.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "mirror-hairstyle-mvp" }, meta: { requestId: res.locals.requestId, apiVersion: "v1" } });
  });

  router.post("/hairstyle/consultations", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const input = consultationRequestSchema.parse(req.body);
      const consultation = await createConsultation({
        imageBase64: input.image.base64,
        mimeType: input.image.mimeType,
        requirements: input.requirements,
        publicOrigin: publicOrigin(req),
      });
      return res.status(201).json({ data: { consultation }, meta: { requestId: id, apiVersion: "v1" } });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.post("/hairstyle/try-ons", async (req, res) => {
    const id = res.locals.requestId as string;
    try {
      const input = tryOnRequestSchema.parse(req.body);
      const tryOn = await createTryOn({ ...input, publicOrigin: publicOrigin(req) });
      return res.status(201).json({ data: { tryOn }, meta: { requestId: id, apiVersion: "v1" } });
    } catch (error) {
      return sendError(res, id, error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => sendError(res, res.locals.requestId ?? "req_unknown", error));
  return router;
}
