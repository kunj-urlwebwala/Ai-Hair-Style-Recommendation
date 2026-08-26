# Flutter Developer Handoff

## Scope

The Flutter application should use the Node API directly for the AI hairstyle feature. It does not need to copy the Expo reference code. Use the reference app only for the screen sequence and behavioral details.

## Required Customer Flow

1. Show portrait guidance and allow the customer to use camera or gallery.
2. Render a portrait review that uses `BoxFit.contain`, not a face-cropping preview.
3. Capture the optional free-text request plus occasion, length, and maintenance preferences.
4. Call `POST /api/v1/hairstyle/consultations` and handle `422 PHOTO_RETAKE_REQUIRED` by returning to photo capture with the API message.
5. Show the returned analysis and four recommendations.
6. After style selection, call `POST /api/v1/hairstyle/try-ons`; render a cancellable loading state and support vertical scrolling on the final try-on page.
7. Compare the unmodified source portrait with `previewImageUrl`; never edit or replace the source portrait locally.

## DTO and Error Rules

Import or generate the request/response models from `docs/openapi.yaml`. The Flutter client should preserve `X-Request-Id` from errors for support diagnostics. Treat a `422` photo-retake response as a normal user correction, not a generic system error.

| API code | Flutter behavior |
|---|---|
| `VALIDATION_ERROR` | Highlight the input or show the safe server message. |
| `INVALID_IMAGE` | Ask the customer to choose a JPEG, PNG, or WebP image under the configured limit. |
| `PHOTO_RETAKE_REQUIRED` | Return to the portrait screen; explain that the hairline, crown, and shoulders must be visible. |
| `AI_PROVIDER_ERROR` | Preserve the current state and show a retry action. |
| `RATE_LIMITED` | Disable immediate retry and show a short, calm wait message. |

## Mobile UX Reference

The existing Expo MVP lives in `app/(tabs)/index.tsx`. It contains the expected behavior for the style-profile back action, explicit “Retake portrait” path, try-on loading state, and before/preview comparison. The Flutter implementation should retain those flows while using native Flutter patterns.
