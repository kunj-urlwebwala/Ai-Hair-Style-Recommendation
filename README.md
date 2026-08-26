# Mirror — AI Hairstyle Consultation & Try-On

Expo (React Native web/iOS/Android) app with an Express + tRPC backend.
Upload a portrait, get a hairstyle consultation powered by Gemini/OpenAI, and
generate identity-preserving virtual try-on previews.

## Requirements

- Node.js 22+ (built-in `node:sqlite` is used for the database)
- pnpm (`npm install -g pnpm`)
- A Gemini API key (free from [Google AI Studio](https://aistudio.google.com/apikey))
  and/or an OpenAI API key

## Setup

```bash
pnpm install
copy .env.example .env   # then fill in GEMINI_API_KEY / OPENAI_API_KEY
pnpm dev
```

- Web app: http://localhost:8081
- API server: http://localhost:3000
- SQLite database and uploaded images are created automatically on first run
  (`database/mirror.db` and `storage/uploads/`).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs session tokens (required) |
| `DATABASE_URL` | SQLite file path, default `file:./database/mirror.db` |
| `STORAGE_DIR` | Local folder for uploads/previews, default `./storage/uploads` |
| `GEMINI_API_KEY` | Google AI Studio key for analysis + image try-on |
| `OPENAI_API_KEY` | OpenAI fallback for analysis + image try-on |
| `AI_ANALYSIS_PRIMARY_MODEL` / `AI_ANALYSIS_FALLBACK_MODEL` | Text models, tried in order |
| `AI_TRYON_PRIMARY_IMAGE_MODEL` / `AI_TRYON_FALLBACK_IMAGE_MODEL` | Image models, tried in order |
| `AI_RATE_LIMIT_CONSULTATIONS` / `AI_RATE_LIMIT_TRY_ONS` | Per-account daily limits (default 15 / 30) |
| `RESEND_API_KEY` + `MAIL_FROM` | Optional; enables password-reset emails via Resend |
| `EXPO_PUBLIC_API_BASE_URL` | Set when running the app on a physical device |

## Auth

Local email/password accounts with JWT sessions (cookie on web, Bearer token on native).
Password reset uses 6-digit one-time codes emailed through Resend when configured.

```bash
POST /api/auth/register         { name, email, password }
POST /api/auth/login            { email, password }
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/forgot-password  { email }
POST /api/auth/reset-password   { email, otp, password }
```

## Core API

AI endpoints require sign-in and are rate limited per account.

```bash
POST   /api/v1/hairstyle/consultations    # { image: { base64, mimeType }, requirements? }
POST   /api/v1/hairstyle/try-ons          # { sourceImageUrl, mimeType, style: { name, prompt } }
GET    /api/v1/hairstyle/saved-looks      # list the account's saved looks
POST   /api/v1/hairstyle/saved-looks      # { consultationId, recommendation, previewImageUrl }
DELETE /api/v1/hairstyle/saved-looks/:id
```

The same flows are also exposed type-safe via tRPC at `/api/trpc`
(`consultation.analyze`, `consultation.tryOn`). Full request/response details:
`docs/openapi.yaml`.

## Scripts

```bash
pnpm dev          # run API server + Expo web dev server together
pnpm check        # TypeScript
pnpm test         # unit tests (vitest)
pnpm lint         # ESLint
```
