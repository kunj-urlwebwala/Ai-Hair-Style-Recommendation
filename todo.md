# Mirror Roadmap

## Done

- Local email/password auth with JWT sessions (web cookie + native Bearer)
- AI hairstyle consultation and identity-preserving try-on via Gemini/OpenAI with failover
- Consultations persisted per account; saved looks synced to the database
- Auth required on AI endpoints with per-account daily rate limits
- Password reset via one-time email codes (optional Resend integration)
- Curated style library on the home screen
- Root error boundary; test suite covering auth flow, DB layer, and rate limits

## Next ideas

- [ ] Show past consultations in a History tab (data already stored)
- [ ] Share/save a preview to device gallery (expo-media-library)
- [ ] Admin role utilities (user list, usage stats) behind the existing admin gate
- [ ] Swap in-memory rate limiting for a shared store when running multiple instances
- [ ] Deployment config: Dockerfile for the API + EAS build profiles for mobile
- [ ] Structured request logging (pino/morgan) and basic metrics
- [ ] Localization pass (Gujarati/Hindi copy alongside English)
