# Mirror AI Hairstyle MVP — Integration Contract

## Purpose

Mirror is a backend-first Node.js MVP for customers who want Indian-contextual hairstyle inspiration and a hairstyle-only visual preview. The system accepts a customer portrait and an optional free-text request, produces a neutral visual analysis and four recommendations, then creates a virtual try-on for one selected style. The customer’s face, identity, skin, facial characteristics, beard, clothing, and background are explicitly preserved in the image-edit request; only hair is intended to change. Image models remain probabilistic, so the API reports this as a best-effort preservation target rather than a numeric guarantee.

The first integration surface is a versioned JSON REST API under `/api/v1`. The existing mobile test interface is a client of this contract, while a Flutter application can consume the same endpoints without depending on application-specific UI state or tRPC.

## Request Lifecycle

| Stage | REST endpoint | Input | Output |
|---|---|---|---|
| Validate and analyze a portrait | `POST /api/v1/hairstyle/consultations` | Portrait bytes as base64, MIME type, free-text requirement, optional occasion and maintenance preference | `422 PHOTO_RETAKE_REQUIRED` when the full hair framing is unavailable, otherwise stored source image, neutral visual analysis, and four recommendations |
| Generate a selected look | `POST /api/v1/hairstyle/try-ons` | Source image URL, style name, style-only prompt, original MIME type | Stored preview URL and generation metadata |
| Check API availability | `GET /api/v1/health` | None | Version, service health, and request ID |

## Indian-Context Recommendation Policy

The assistant must not infer nationality, caste, religion, ethnicity, gender identity, age, attractiveness, health, or personality from a portrait. Instead, the API uses the caller-provided requirements and an inclusive Indian salon vocabulary. It may consider phrases such as **professional**, **short haircut**, **festive**, **wedding**, **bridal**, **grooming**, **traditional**, **modern**, **low-maintenance**, and **natural texture**.

Recommendations should account for visible hair texture and density only when the image makes that feasible. They should keep naturally straight, wavy, curly, coily, dense, or fine hair credible rather than forcing a uniform look. A wedding request may propose event-appropriate directions such as textured buns, soft waves, braids, or polished updos; it must not add adornments, garments, jewellery, makeup, or change any non-hair feature unless the client separately enables that scope.

## Consultation Request

```json
{
  "image": {
    "base64": "<base64 image bytes, without a data URI prefix>",
    "mimeType": "image/jpeg"
  },
  "requirements": {
    "prompt": "I want a polished low-maintenance professional look with short hair.",
    "occasion": "professional",
    "lengthPreference": "short",
    "maintenancePreference": "low"
  }
}
```

The `prompt` field is optional but recommended and is limited to 500 characters. `occasion`, `lengthPreference`, and `maintenancePreference` are optional, normalized values that improve filtering and later analytics. The request accepts `image/jpeg`, `image/png`, and `image/webp` only, with a maximum decoded file size of 10 MB. The service checks whether enough of the hairline, crown, and portrait framing is visible; a too-close photo is returned as a guided `422` retake response rather than generating an unreliable hairstyle result.

## Consultation Response

```json
{
  "data": {
    "consultation": {
      "id": "con_9b9c3d1e",
      "sourceImageUrl": "https://api.example.com/uploads/consultations/example.jpg",
      "requirements": {
        "prompt": "I want a polished low-maintenance professional look with short hair.",
        "occasion": "professional",
        "lengthPreference": "short",
        "maintenancePreference": "low"
      },
      "analysis": {
        "faceShape": "Neutral visual frame descriptor",
        "overview": "A concise visual explanation.",
        "featureNotes": ["..."],
        "stylePrinciples": ["..."],
        "confidenceNote": "Visual guidance from a single portrait."
      },
      "recommendations": [
        {
          "id": "style-id",
          "name": "Style name",
          "description": "Concise description",
          "whyItWorks": "Neutral rationale",
          "maintenance": "Medium",
          "texture": "Natural movement",
          "tone": "Professional",
          "prompt": "Hairstyle-only edit instruction"
        }
      ]
    }
  },
  "meta": { "requestId": "req_...", "apiVersion": "v1" }
}
```

## Try-On Request

```json
{
  "sourceImageUrl": "https://api.example.com/uploads/consultations/example.jpg",
  "mimeType": "image/jpeg",
  "style": {
    "id": "textured-taper",
    "name": "Textured taper",
    "prompt": "Create a neat short textured taper with a soft side part and natural hair texture."
  }
}
```

The API re-applies its preservation guardrails server-side. The client prompt is treated as a hairstyle description, never as authority to modify identity or facial characteristics.

## Error Envelope

Every error uses a consistent response shape and includes a request ID for support and observability.

```json
{
  "error": {
    "code": "INVALID_IMAGE",
    "message": "Please provide a JPEG, PNG, or WebP portrait smaller than 10 MB.",
    "requestId": "req_..."
  }
}
```

| HTTP status | Error code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request body or field value |
| `400` | `INVALID_IMAGE` | Unsupported or oversized portrait input |
| `413` | `PAYLOAD_TOO_LARGE` | JSON body exceeds service limit |
| `422` | `PHOTO_RETAKE_REQUIRED` | Portrait is too close or lacks enough visible hair framing for a reliable hairstyle-only preview |
| `429` | `RATE_LIMITED` | Caller has exceeded the MVP request limit |
| `502` | `AI_PROVIDER_ERROR` | Analysis or image-generation provider did not produce a usable result |
| `500` | `INTERNAL_ERROR` | Unexpected server failure |

## Node.js MVP Architecture

| Layer | Responsibility | Production evolution |
|---|---|---|
| **Express REST router** | Versioned endpoints, request IDs, CORS, schema validation, and error envelope | Add API gateway, OpenAPI-based code generation, and OAuth/JWT middleware |
| **Hairstyle service** | Image preparation, Indian-context AI instruction, response parsing, hairstyle-only generation guardrails | Move to isolated workers and idempotent job records |
| **Object storage adapter** | Stores source portraits and generated preview assets | Add encryption policy, TTL lifecycle deletion, malware scanning, and tenant-scoped keys |
| **AI adapters** | Calls multimodal analysis and image-edit providers only from the server | Add provider abstraction, model evaluation, fallbacks, and asynchronous retries |
| **Client adapter** | Flutter/mobile client receives stable JSON and public asset URLs | Use generated Flutter DTOs from OpenAPI and signed authenticated uploads |

The current MVP intentionally keeps no customer identity table and no database persistence. For production, the long-running image-edit request should become `POST /try-ons` → `202 Accepted` with a job identifier, a queue worker, a callback or polling endpoint, durable job state, and an auditable image-retention policy. The MVP defaults to medium image quality to reduce evaluation wait time; quality is environment-configured and should be measured against identity-preservation quality before any production choice.

## Flutter Integration Notes

Flutter should submit JPEG bytes as base64 only for the MVP; production clients should use a short-lived presigned upload session to avoid base64 overhead. The response contains only display-ready URLs and normalized JSON fields. The Flutter application should render `data.consultation`, persist the selected recommendation ID locally, and call the try-on endpoint only after a customer selects a style.

The Laravel platform can later issue application-scoped JWTs or signed user context to this Node service. The Node service should validate that token, attach tenant and customer identifiers to storage keys and telemetry, and return the same versioned response format to Flutter.
