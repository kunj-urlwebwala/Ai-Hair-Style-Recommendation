# Backend Engineer Handoff

## Current API Surface

The Node service exposes these versioned routes under `/api/v1`:

| Method | Route | Responsibility |
|---|---|---|
| `GET` | `/health` | Service availability and API version response. |
| `POST` | `/hairstyle/consultations` | Validates and stores a portrait, checks portrait framing, analyzes visual style context, and returns four recommendations. |
| `POST` | `/hairstyle/try-ons` | Verifies that the source portrait belongs to this service, then requests a hairstyle-only image edit. |

`docs/openapi.yaml` is the source of truth for Flutter-ready request and response DTOs. All application errors use an `error.code`, a user-safe `message`, and a `requestId`.

## Source Modules

| Module | Role |
|---|---|
| `server/api/v1-hairstyle-router.ts` | Express request parsing, API versioning, response envelopes, request IDs, and REST errors. |
| `server/hairstyle-service.ts` | Portrait storage, AI prompt construction, model failover, hairstyle-only preservation rules, and provider error normalization. |
| `server/_core/llm.ts` | Server-only multimodal LLM proxy client with retry behavior. |
| `server/_core/imageGeneration.ts` | Server-only image editing client and generated-asset storage. |
| `server/storage.ts` | Storage upload abstraction. |
| `server/_core/index.ts` | Express startup, CORS policy, body limits, and route registration. |

## Model Routing

No direct provider key is needed for the present built-in gateway. The deployment can override these optional variables without a code change.

| Variable | Default | Use |
|---|---|---|
| `AI_ANALYSIS_PRIMARY_MODEL` | `gemini-3-flash-preview` | First multimodal portrait-analysis model. |
| `AI_ANALYSIS_FALLBACK_MODEL` | `gpt-5-mini` | Used only if the primary analysis call fails. |
| `AI_TRYON_PRIMARY_IMAGE_MODEL` | `MODEL_GPT_IMAGE_2` | First image-edit model enum. |
| `AI_TRYON_FALLBACK_IMAGE_MODEL` | empty | Optional backup image model; when omitted, the platform image default is attempted after a primary failure. |
| `AI_TRYON_IMAGE_QUALITY` | `medium` | Faster MVP default. Use `high` only when evaluating visual fidelity versus latency. |

The AI service records the selected analysis and preview model in each successful response. Do not send provider credentials to Flutter, Laravel, or browser/mobile clients. Use the model metadata plus `ai_model_attempts` in the proposed database to measure fallback rate and latency before changing the production default.

## Production Hardening Plan

The synchronous MVP is suitable for controlled testing. A production build should turn try-on generation into a durable job flow:

1. Accept a validated portrait through a signed upload session and store it under a tenant/customer-scoped key.
2. Create a `consultations` record and return an identifier immediately.
3. For a selected hairstyle, create a `try_on_jobs` record and return `202 Accepted` with the job ID.
4. Process image editing in a queue worker with bounded retries and idempotency keys.
5. Expose `GET /api/v1/hairstyle/try-ons/{id}` for polling or send a signed webhook to Laravel.
6. Keep a model, latency, and error audit record for every provider attempt; never write a raw portrait or provider key to logs.

## Security and Data Rules

The API currently restricts a try-on source to an image previously stored under the consultation path on the same API origin. Preserve this check when moving to signed storage. Validate MIME type and decoded byte size before storage. Production should add authenticated tenant context from Laravel, presigned upload URLs, a short asset-retention policy, image-malware scanning, rate limits, request-size limits, and a real CORS allowlist.

The hairstyle prompt is a server-side constraint. The client may describe desired hair, but it must never be able to request a face, identity, skin, clothing, or background change. The system reports an identity-preserving target, not a numerical guarantee, because image edits are probabilistic.
